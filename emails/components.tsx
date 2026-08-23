import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";

/** Shared Meridian email chrome — warm ivory, botanical accents. */

const styles = {
  body: {
    backgroundColor: "#F7F4EE",
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    margin: 0,
    padding: "32px 16px",
  },
  container: {
    backgroundColor: "#FFFFFF",
    border: "1px solid rgba(23,32,29,0.1)",
    borderRadius: "20px",
    margin: "0 auto",
    maxWidth: "520px",
    padding: "40px",
  },
  brand: {
    color: "#17201D",
    fontSize: "18px",
    fontWeight: 700,
    letterSpacing: "-0.01em",
    margin: "0 0 28px",
  },
  brandAccent: { color: "#174C3C" },
  heading: {
    color: "#17201D",
    fontSize: "22px",
    fontWeight: 600,
    letterSpacing: "-0.01em",
    lineHeight: "1.3",
    margin: "0 0 16px",
  },
  text: {
    color: "#5F6965",
    fontSize: "14px",
    lineHeight: "1.65",
    margin: "0 0 14px",
  },
  button: {
    backgroundColor: "#174C3C",
    borderRadius: "999px",
    color: "#FCFBF8",
    display: "inline-block",
    fontSize: "14px",
    fontWeight: 600,
    padding: "12px 28px",
    textDecoration: "none",
  },
  hr: { borderColor: "rgba(23,32,29,0.1)", margin: "28px 0" },
  footer: {
    color: "#8B948F",
    fontSize: "11px",
    lineHeight: "1.6",
    margin: 0,
  },
} as const;

/**
 * Wellbeing Pulse is a sibling product with its own mark and its own footer
 * disclaimer. Both are optional overrides: every existing DISC360 template
 * passes neither and renders exactly as before.
 */
export interface EmailBrand {
  /** Leading word, rendered in ink. */
  name: string;
  /** Trailing word, rendered in the brand accent. */
  accent: string;
  accentColor: string;
}

const WELLBEING_BRAND: EmailBrand = {
  name: "Wellbeing ",
  accent: "Pulse",
  accentColor: "#1F4E5F",
};

export const EMAIL_BRANDS = { wellbeing: WELLBEING_BRAND } as const;

export function EmailShell({
  preview,
  heading,
  children,
  cta,
  footerNote,
  brand,
  disclaimer,
}: {
  preview: string;
  heading: string;
  children: React.ReactNode;
  cta?: { href: string; label: string };
  footerNote?: string;
  /** Defaults to the DISC360 wordmark. */
  brand?: EmailBrand;
  /** Defaults to the DISC360 product disclaimer. */
  disclaimer?: string;
}) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          {brand ? (
            <Text style={styles.brand}>
              {brand.name}
              <span style={{ color: brand.accentColor }}>{brand.accent}</span>
            </Text>
          ) : (
            <Text style={styles.brand}>
              DISC<span style={styles.brandAccent}>360</span>
            </Text>
          )}
          <Heading style={styles.heading}>{heading}</Heading>
          {children}
          {cta ? (
            <Section style={{ margin: "24px 0 8px" }}>
              <Link href={cta.href} style={styles.button}>
                {cta.label}
              </Link>
            </Section>
          ) : null}
          <Hr style={styles.hr} />
          <Text style={styles.footer}>
            {footerNote ??
              "You're receiving this because of your DISC360 account. Manage notification preferences from Settings."}{" "}
            {disclaimer ??
              "DISC360 is a development tool — not a medical, clinical or employment-selection instrument."}
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export function EmailText({ children }: { children: React.ReactNode }) {
  return <Text style={styles.text}>{children}</Text>;
}
