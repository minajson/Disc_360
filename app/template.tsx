import { MotionShell } from "@/components/motion/MotionShell";

export default function Template({ children }: { children: React.ReactNode }) {
  return <MotionShell>{children}</MotionShell>;
}
