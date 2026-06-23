import Reveal from "./Reveal";

/** Consistent mono index + oversized display title used to open each section. */
export default function SectionHeading({
  index,
  label,
  title,
}: {
  index: string;
  label: string;
  title: React.ReactNode;
}) {
  return (
    <Reveal>
      <div className="flex items-center gap-4">
        <span className="font-mono text-sm text-volt" aria-hidden="true">
          {index}
        </span>
        <span className="label">{label}</span>
        <span className="h-px flex-1 bg-line" aria-hidden="true" />
      </div>
      <h2 className="display mt-4 text-[clamp(2.25rem,6vw,4.5rem)] text-paper">
        {title}
      </h2>
    </Reveal>
  );
}
