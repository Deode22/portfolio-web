export type SkillGroup = {
  id: string;
  label: string;
  items: string[];
};

export const stackIntro =
  "The tools I rely on to turn field reality and earth observation into dependable production software, grouped by domain.";

export const skillGroups: SkillGroup[] = [
  {
    id: "geo",
    label: "Geospatial & Earth Observation",
    items: [
      "QGIS / PyQGIS",
      "GDAL / OGR",
      "Python for GIS",
      "Jupyter Notebooks & Server",
      "Sattelite Imagery",
      "LiDAR: PDAL, CloudCompare",
      "Google Earth Engine",
      "ArcGIS Pro",
    ],
  },
  {
    id: "data-backend",
    label: "Data Engineering & Spatial Backend",
    items: [
      "Python",
      "PostgreSQL / PostGIS",
      "DuckDB",
      "Airflow / Prefect",
      "Apache GeoServer",
      "End to end Pipelines",
      "FastAPI",
      "R",
      "Bash",
    ],
  },
  {
    id: "frontend-delivery",
    label: "Frontend & Product Delivery",
    items: [
      "Next.js",
      "React",
      "Dash - Plotly",
      "Streamlit",
      "Grafana / Power BI",
      "Automated Reporting (PDF/Dossiers w/ Python)",
    ],
  },
  {
    id: "infra",
    label: "Infrastructure & DevOps",
    items: [
      "Cloud Deployment (GCP, Local VPS)",
      "Docker",
      "Linux Server Administration",
      "Git / GitHub Actions",
      "Microservices Architecture",
      "Cron / Scheduled Jobs",
    ],
  },
  {
    id: "languages",
    label: "Languages",
    items: ["Spanish — Native", "English — C1 (Professional working proficiency)"],
  },
];
