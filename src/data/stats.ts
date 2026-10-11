export type Stat = {
  id: string;
  value: number;
  prefix?: string;
  suffix?: string;
  /** Short instrument readout shown above the figure. */
  meta: string;
  label: string;
  /** Where the number came from — one line, always present. */
  footnote: string;
};

export const stats: Stat[] = [
  {
    id: "carbon-area",
    value: 3000,
    suffix: "+ ha",
    meta: "Carbon Feasibility",
    label: "Land audited for carbon eligibility",
    footnote: "On-site field assessment combined with GIS spatial analysis",
  },
  {
    id: "automation",
    value: 80,
    suffix: "%",
    meta: "Automation",
    label: "Forestry & GIS workflow automation",
    footnote: "Up to 80% repetitive consulting tasks automated via custom pipelines",
  },
  {
    id: "admin-time",
    value: 50,
    suffix: "%",
    meta: "Efficiency",
    label: "Regulatory turnaround cut",
    footnote: "Achieved by architecting digital data infrastructure & streamlined exploitation",
  },
];