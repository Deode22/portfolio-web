import { siteCopy } from "./profile";

export type ProjectSpan = "lg" | "md" | "sm";

export type Project = {
  id: string;
  title: string;
  blurb: string;
  /** Omitted for entries with no public repository. */
  repo?: string;
  repoLabel?: string;
  stack: string[];
  span: ProjectSpan;
  thumbnail: string;
  /** Display-only metadata shown above the title. */
  meta?: string;
};

export const projectsIntro =
  "Four tools that came out of real delivery work. The first is the one I lean on most; the rest are smaller and sharper.";

export const projects: Project[] = [
  {
    id: "rusle-cli",
    title: "rusle-cli",
    blurb:
      "Containerized soil erosion (RUSLE) screening engine. Automates ingestion from Sentinel-2, ERA5-Land, and AEMET API with end-to-end cleaning, spatial computation, and automated reporting.",
    repo: `${siteCopy.github}/rusle-cli`,
    repoLabel: "github.com/Deode22/rusle-cli",
    stack: ["Python", "Docker", "Sentinel-2", "ERA5-Land", "AEMET API", "Rasterio", "Reporting"],
    span: "lg",
    thumbnail: "projects/rusle-cli.png",
    meta: "PIPELINE / SCREENING",
  },
  {
    id: "extractor-aemet",
    title: "extractor_aemet",
    blurb:
      "Automated climate ETL micro-tool consuming the AEMET OpenData API. Cleans, normalizes, and schedules daily observational data structured for downstream analytics and Business Intelligence dashboards.",
    repo: `${siteCopy.github}/extractor_aemet`,
    repoLabel: "github.com/Deode22/extractor_aemet",
    stack: ["Python", "AEMET API", "ETL", "BI Analytics", "Cron", "PostgreSQL"],
    span: "md",
    thumbnail: "projects/extractor-aemet.png",
    meta: "CLIMATE / BI ETL",
  },
  {
    id: "prophet-predicting",
    title: "Prophet-Predicting",
    blurb:
      "NDVI time-series reconstruction using Meta's Prophet. Trained on historical Sentinel-2 vegetation dynamics to impute and correct sensor calibration drift across an uncalibrated temporal window.",
    repo: `${siteCopy.github}/Prophet-Predicting`,
    repoLabel: "github.com/Deode22/Prophet-Predicting",
    stack: ["Python", "Prophet", "Sentinel-2", "Xarray", "Streamlit", "Plotly"],
    span: "md",
    thumbnail: "projects/prophet-predicting.png",
    meta: "TIME-SERIES / SENSOR RECONSTRUCTION",
  },
  {
    id: "plantation-field-modelling",
    title: "Plantation Morpho-Physiological Modelling",
    blurb:
      "Field-calibrated structural baseline across 4 pilot forest plantations at UPM. Synthesizes in-situ dendrometric and physiological traits into reproducible spatial datasets for forestry monitoring.",
    stack: ["Forest Inventory", "Field Data", "QGIS", "Data Modelling", "UPM"],
    span: "md",
    thumbnail: "projects/plantation-field-modelling.png",
    meta: "FORESTRY",
  },
];