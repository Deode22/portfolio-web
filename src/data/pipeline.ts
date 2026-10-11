export type PipelineNode = {
  id: string;
  index: string;
  label: string;
  tool: string;
  example: string;
  detail: string;
};

export const pipelineIntro =
  "From raw field measurements and Earth observation to production software: transforming complex spatial engineering into dependable, user-facing digital solutions.";

export const pipelineNodes: PipelineNode[] = [
  {
    id: "raw",
    index: "00",
    label: "Ingestion & Ground Truth",
    tool: "Field campaigns · Sentinel-2 · PNOA LiDAR · AEMET API",
    example: "Harmonizing remote sensing with in-situ field plots",
    detail:
      "Standardized multi-source ingestion reconciling physical forest inventory and dendrometric campaigns with satellite archives, classified LiDAR tiles, and daily meteorological station feeds.",
  },
  {
    id: "etl",
    index: "01",
    label: "High-Performance ETL",
    tool: "Polars · Rasterio · Shapely · PDAL",
    example: "Lazy, memory-efficient spatial processing",
    detail:
      "Typed, lazy-evaluated data pipelines using Polars and Rasterio for point-cloud feature extraction, coordinate transformation, and geometry cleanup without memory bottlenecks.",
  },
  {
    id: "store",
    index: "02",
    label: "Spatial Architecture",
    tool: "PostgreSQL + PostGIS · Linux Server",
    example: "Indexed topologies & relational spatial models",
    detail:
      "Centralized relational models enforcing topological integrity, spatial GiST indexing, and fast query execution to reliably serve downstream analytics and regulatory audits.",
  },
  {
    id: "model",
    index: "03",
    label: "Domain Geoprocessing",
    tool: "RUSLE CLI · Hydrological Engines · Carbon Curves",
    example: "Deterministic forestry & environmental computation",
    detail:
      "Domain-calibrated algorithms for soil erosion screening, watershed hydrology, and allometric carbon tonnage estimation, packaged into reproducible, testable CLI tools.",
  },
  {
    id: "delivery",
    index: "04",
    label: "Production & Delivery",
    tool: "Docker · Microservices · UI · Custom QGIS Plugins",
    example: "Abstracting backend complexity into user-ready tools",
    detail:
      "Containerized microservices and automated reporting engines running on dedicated Linux servers. Complex geodata logic is abstracted into interactive Dash/NextJS web apps, custom QGIS desktop plugins, and regulatory audit dossiers for non-technical teams.",
  },
];
