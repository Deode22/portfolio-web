export const siteCopy = {
  name: "Daniel Fernández Villanueva",
  shortName: "Daniel F. V.",
  title: "Geospatial Data Engineer\nForestry Domain Expert",
  valueProp:
    "Bridging Forestry & Earth Science with Scalable Solutions",
  description:
    "Forestry Engineer (UPM) turned geospatial data engineer. Building end-to-end data infrastructure, remote sensing products, and LiDAR pipelines that turn complex Earth observation into auditable, field-ready insights.",
  location: "Madrid, Spain",
  locationShort: "Madrid, ES",
  coordinates: "40.4168 N · 3.7038 W",
  email: "daniel.fdezv@pm.me",
  github: "https://github.com/Deode22",
  linkedin:
    "https://www.linkedin.com/in/daniel-fernández-villanueva-94b984261/",
  siteOrigin: "https://daniel-fv-portfolio.local",
  cvPath: "/documents/Daniel_Fernandez_CV.pdf",
  avatarPath: "/images/avatar.jpg",
} as const;

export type SiteCopy = typeof siteCopy;

export const contactIntro =
  "Forestry operations, carbon inventories, R&D tooling or ETL modernisation — happy to scope a short call to see whether there is a fit.";

/**
 * `siteCopy.email` ships as a sentinel until a real address is set. Resolving
 * it here keeps every consumer honest without any component sniffing strings:
 * consumers render the email affordances only when this is non-null.
 */
export const contactEmail: string | null = siteCopy.email.startsWith(
  "EMAIL_PLACEHOLDER"
)
  ? null
  : siteCopy.email;
