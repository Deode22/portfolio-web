#!/usr/bin/env python3
"""
Pipeline de procesamiento PNOA LiDAR:
1. Normalización de alturas y generación de CHM (GeoTIFF 2m).
2. Extracción de métricas estructurales por rodal (P95, FCC, densidad) -> GeoJSON.

Todas las alturas de dosel (p95_height, mean_height) se expresan sobre el suelo
(CHM = DSM - DTM). Nunca altitud absoluta: la cota del terreno se resta punto a
punto mediante el DTM interpolado, de modo que una encina de 9 m nunca devuelve
la cota de la parcela.

Sobre el suelo no se mide el diámetro, así que la vía indirecta estándar es:
altura -> diámetro normal (curva altura-diámetro) -> sistema aditivo de biomasa
de Ruiz-Peinado, del Río y Montero (2011) para Pinus halepensis (pino carrasco).
El resultado se agrega por hectárea bajo el campo `estimated_timber_volume`.
"""

import sys

import numpy as np
import laspy
import rasterio
from rasterio.transform import from_origin
from scipy.interpolate import griddata
import geopandas as gpd
from shapely.geometry import box

# --- Curva altura-diámetro (Chapman-Richards invertida) ---------------------
# h = 1.3 + a * (1 - e^(-b*d))^c  ->  d = -(1/b) * ln(1 - ((h-1.3)/a)^(1/c))
# Parámetros orientativos para Pinus halepensis (placeholder hasta disponer
# del ajuste del IFN provincial / estrato geográfico de referencia).
HD_A, HD_B, HD_C = 20.0, 0.035, 1.4

# Fracción de biomasa seca total por hectárea bajo cubierta cerrada (pies/ha).
# Aproximación provisional mientras no haya conteo individual de pies.
STEMS_PER_HA_FULL_COVER = 500.0


def diameter_from_height(h):
    """Despeja el diámetro normal (cm) de la curva altura-diámetro."""
    if h <= 1.3:
        return 0.0
    base = min((h - 1.3) / HD_A, 1.0 - 1e-9)
    return float(-(1.0 / HD_B) * np.log(1.0 - base ** (1.0 / HD_C)))


def tree_biomass_kg(d, h):
    """Biomasa seca total por pie (kg) — sistema aditivo Pinus halepensis,
    Ruiz-Peinado, del Río y Montero (2011)."""
    w_s = 0.0139 * d ** 2 * h
    w_b7 = 3.926 * (d - 27.5) if d > 27.5 else 0.0
    w_b2_7 = 4.257 + 0.00506 * d ** 2 * h - 0.0722 * d * h
    w_b2_l = 6.197 + 0.00932 * d ** 2 * h - 0.0686 * d * h
    w_r = 0.0785 * d ** 2
    return float(w_s + w_b7 + w_b2_7 + w_b2_l + w_r)


def process_pnoa_laz(laz_path, output_chm_path, output_geojson_path, resolution=2.0):
    print(f"[*] Leyendo archivo LiDAR: {laz_path}...")
    las = laspy.read(laz_path)

    # Coordenadas y clasificaciones PNOA
    x = las.x
    y = las.y
    z = las.z
    classification = las.classification

    min_x, max_x = np.min(x), np.max(x)
    min_y, max_y = np.min(y), np.max(y)
    total_area_m2 = (max_x - min_x) * (max_y - min_y)
    point_density = len(x) / total_area_m2

    print(f"    - Extensión: X[{min_x:.1f}, {max_x:.1f}], Y[{min_y:.1f}, {max_y:.1f}]")
    print(f"    - Densidad media de pulsos: {point_density:.2f} pts/m²")

    # 1. Separar suelo (clase 2) y vegetación (clases 3, 4, 5)
    ground_mask = (classification == 2)
    veg_mask = np.isin(classification, [3, 4, 5])

    if not np.any(ground_mask):
        raise ValueError("No se encontraron puntos de suelo clasificados (clase 2).")

    # Rejilla común (filas/columnas) para DTM, DSM y normalización
    cols = int((max_x - min_x) / resolution) + 1
    rows = int((max_y - min_y) / resolution) + 1
    col_idx = np.clip(((x - min_x) / resolution).astype(int), 0, cols - 1)
    row_idx = np.clip(((max_y - y) / resolution).astype(int), 0, rows - 1)

    # Centros de celda, alineados con el binning del DSM (fila 0 = norte)
    grid_x = min_x + (np.arange(cols) + 0.5) * resolution
    grid_y = max_y - (np.arange(rows) + 0.5) * resolution
    grid_xx, grid_yy = np.meshgrid(grid_x, grid_y)

    print("[*] Interpolando DTM (Modelo Digital del Terreno)...")
    ground_points = np.vstack((x[ground_mask], y[ground_mask])).T
    ground_z = z[ground_mask]

    dtm = griddata(ground_points, ground_z, (grid_xx, grid_yy), method='linear')
    nan_mask = np.isnan(dtm)
    if np.any(nan_mask):
        dtm_nearest = griddata(ground_points, ground_z, (grid_xx, grid_yy), method='nearest')
        dtm[nan_mask] = dtm_nearest[nan_mask]

    print("[*] Calculando DSM e interpolando Modelo Digital de Superficie...")
    # Binning máximo para vegetación
    dsm = np.full((rows, cols), np.nan)

    for r, c, val in zip(row_idx, col_idx, z):
        if np.isnan(dsm[r, c]) or val > dsm[r, c]:
            dsm[r, c] = val

    # Si hay huecos en el DSM, rellenar con DTM
    dsm = np.where(np.isnan(dsm), dtm, dsm)

    # 2. CHM = DSM - DTM (altura de dosel sobre el suelo)
    chm = dsm - dtm
    chm[chm < 0] = 0.0          # Eliminar alturas negativas
    chm[chm > 50.0] = np.nan    # Filtrar valores atípicos/ruido (> 50 m)

    # Altura normalizada punto a punto: cota del retorno menos cota del suelo en
    # su misma celda. Esto es lo que evita devolver la altitud de la parcela.
    norm_height = z - dtm[row_idx, col_idx]

    # 3. Guardar CHM como GeoTIFF
    print(f"[*] Guardando CHM en {output_chm_path}...")
    transform = from_origin(min_x, max_y, resolution, resolution)

    # Intentar obtener CRS del LAZ (por defecto PNOA suele ser ETRS89 UTM huso 30 EPSG:25830)
    crs = "EPSG:25831"
    try:
        if las.header.vlrs:
            for vlr in las.header.vlrs:
                if "crs" in dir(vlr) and vlr.crs:
                    crs = vlr.crs.to_epsg() or crs
    except Exception:
        pass

    with rasterio.open(
        output_chm_path,
        'w',
        driver='GTiff',
        height=chm.shape[0],
        width=chm.shape[1],
        count=1,
        dtype=np.float32,
        crs=crs,
        transform=transform,
        nodata=-9999.0
    ) as dst:
        clean_chm = np.nan_to_num(chm, nan=-9999.0).astype(np.float32)
        dst.write(clean_chm, 1)

    # 4. Generar rodales de ejemplo con métricas para el GeoJSON
    print("[*] Extrayendo métricas forestales por rodal para el GeoJSON...")
    # Dividimos la tesela en una cuadrícula de 3x3 rodales de demostración
    step_x = (max_x - min_x) / 3
    step_y = (max_y - min_y) / 3
    features = []

    for i in range(3):
        for j in range(3):
            sub_min_x = min_x + i * step_x
            sub_max_x = sub_min_x + step_x
            sub_min_y = min_y + j * step_y
            sub_max_y = sub_min_y + step_y

            stand_geom = box(sub_min_x, sub_min_y, sub_max_x, sub_max_y)

            # Puntos dentro del rodal
            in_stand = (x >= sub_min_x) & (x < sub_max_x) & (y >= sub_min_y) & (y < sub_max_y)
            stand_norm = norm_height[in_stand]
            stand_norm = stand_norm[np.isfinite(stand_norm)]

            if len(stand_norm) < 100:
                continue

            # Alturas de vegetación sobre el suelo dentro del rodal
            veg_in_stand = in_stand & veg_mask
            veg_norm = norm_height[veg_in_stand]
            veg_norm = veg_norm[np.isfinite(veg_norm) & (veg_norm > 0)]

            if len(veg_norm) > 50:
                p95_h = float(np.percentile(veg_norm, 95))
                mean_h = float(np.mean(veg_norm))
            else:
                p95_h, mean_h = 0.0, 0.0

            # Fraction of Canopy Cover: retornos a más de 2 m sobre el suelo
            fcc = float((np.sum(stand_norm > 2.0) / len(stand_norm)) * 100)

            # Vía indirecta: diámetro a partir de la altura dominante y sistema
            # aditivo de Ruiz-Peinado; agregado a hectárea por densidad de pies.
            diameter_cm = diameter_from_height(p95_h)
            biomass_kg = tree_biomass_kg(diameter_cm, p95_h)
            stems_ha = STEMS_PER_HA_FULL_COVER * (fcc / 100.0)
            timber_volume = biomass_kg * stems_ha / 1000.0

            features.append({
                "type": "Feature",
                "geometry": stand_geom,
                "properties": {
                    "stand_id": f"PNOA-STD-{i+1}{j+1}",
                    "dominant_species": "Pinus halepensis",
                    "p95_height": round(p95_h, 1),
                    "mean_height": round(mean_h, 1),
                    "canopy_cover_fcc": round(fcc, 1),
                    "estimated_timber_volume": round(timber_volume, 1),
                    "point_density": round(len(stand_norm) / ((sub_max_x - sub_min_x) * (sub_max_y - sub_min_y)), 2)
                }
            })

    # Crear GeoDataFrame y reproyectar a WGS84 (EPSG:4326) para visualizadores web
    gdf = gpd.GeoDataFrame.from_features(features, crs=crs)
    gdf_wgs84 = gdf.to_crs(epsg=4326)
    gdf_wgs84.to_file(output_geojson_path, driver="GeoJSON")
    print(f"[✓] GeoJSON de métricas estructurales exportado a {output_geojson_path}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Uso: python process_pnoa_lidar.py archivo.laz [output_chm.tif] [output_stands.geojson]")
        sys.exit(1)

    laz_file = sys.argv[1]
    chm_file = sys.argv[2] if len(sys.argv) > 2 else "public/rasters/pnoa-chm-2m.tif"
    geojson_file = sys.argv[3] if len(sys.argv) > 3 else "public/geojson/lidar-canopy-metrics.geojson"

    process_pnoa_laz(laz_file, chm_file, geojson_file)
