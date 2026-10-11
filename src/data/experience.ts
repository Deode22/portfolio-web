export type Experience = {
  company: string;
  role: string;
  period: string;
  location: string;
  highlights: string[];
};

export const experienceIntro =
  "Forestry engineer bridging field inventories and scalable geospatial architectures: from nationwide forest data models to automated carbon pipelines.";

export const experiences: Experience[] = [
  {
    company: "Spanish National Forest Inventory (IFN)",
    role: "Technical Collaborator — Data Modelling & Scalability",
    period: "Feb 2026 — Present",
    location: "Spain (National)",
    highlights: [
      "Advising on data architecture, schema redesign, and scalability for nationwide forest geospatial datasets.",
      "Developing reproducible spatial data models to streamline cross-regional forestry analytics.",
    ],
  },
  {
    company: "Grupo Sylvestris S.L.",
    role: "Forestry Engineering Consultant (Carbon & Data)",
    period: "Apr 2025 — Present",
    location: "Madrid, Spain",
    highlights: [
      "Python engineer driving digital infrastructure and workflow automation across forestry and carbon project generation.",
      "Audited +3,000 ha for ARR carbon project eligibility through combined field inspections and GIS spatial analysis.",
      "Automated up to ~80% of the forest management plan pipeline (audit → species selection → biomass/carbon tonnage → drafting).",
      "Cut OECC administrative registration time by ~50% through digital data architecture.",
      "Engineered ~4 production geoprocessing pipelines (hydrological analysis, PostGIS geometry integrity) and interactive frontend tools for non-technical teams.",
    ],
  },
  {
    company: "Polytechnic University of Madrid (UPM)",
    role: "GIS / R&D Technician",
    period: "Jan 2024 — Mar 2025",
    location: "Madrid, Spain",
    highlights: [
      "End-to-end ownership of field campaigns, dendrometric inventory, and structural modeling across 4 research plantations.",
      "Built spatial and scientific data pipelines with Python and SQL, integrating heterogeneous geospatial sources into reproducible datasets.",
    ],
  },
];
