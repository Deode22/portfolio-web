import { HeroSection } from "@/components/sections/hero-section";
import { MapSandboxSection } from "@/components/sections/map-sandbox-section";
import { ProjectsSection } from "@/components/sections/projects-section";
import { ExperienceSection } from "@/components/sections/experience-section";
import { PipelineSection } from "@/components/sections/pipeline-section";
import { StackSection } from "@/components/sections/stack-section";
import { ContactSection } from "@/components/sections/contact-section";
import { SiteHeader } from "@/components/site/site-header";

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="flex flex-1 flex-col">
        <HeroSection />
        <MapSandboxSection />
        <ProjectsSection />
        <ExperienceSection />
        <PipelineSection />
        <StackSection />
        <ContactSection />
      </main>
    </>
  );
}
