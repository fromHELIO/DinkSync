import logoSrc from "../assets/DinkSync_logo.svg";

export default function Logo({ variant = "compact" }) {
  return (
    <img
      src={logoSrc}
      alt="DinkSync"
      className={variant === "hero" ? "logo-hero" : "logo-compact"}
    />
  );
}