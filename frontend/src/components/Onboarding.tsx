import { motion } from 'framer-motion';
import { Eye, Globe, ShieldCheck, Sparkles, ToggleLeft } from 'lucide-react';
import { Button } from '@/components/ui';
import { useAppStore } from '@/stores/useAppStore';

const POINTS = [
  { icon: Eye, text: 'Rayzek monitors network connections from this computer only.' },
  { icon: ShieldCheck, text: 'Some process details require administrator or root privileges.' },
  { icon: Globe, text: 'External IP geolocation can be disabled in Settings → Privacy.' },
  { icon: ToggleLeft, text: 'Rayzek never blocks connections automatically.' },
  { icon: Sparkles, text: 'Unusual activity does not automatically mean malware.' },
];

export function Onboarding() {
  const complete = useAppStore((s) => s.completeOnboarding);
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="rz-panel w-full max-w-lg p-7"
      >
        <div className="flex items-center gap-3">
          <img src="/rayzek.svg" alt="" className="h-10 w-10" />
          <div>
            <h1 className="text-xl font-bold tracking-tight text-text">Welcome to RAYZEK</h1>
            <p className="text-sm text-muted">See where your computer is talking.</p>
          </div>
        </div>

        <ul className="mt-6 space-y-3">
          {POINTS.map(({ icon: Icon, text }, i) => (
            <li key={i} className="flex items-start gap-3 text-sm text-text">
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
              <span>{text}</span>
            </li>
          ))}
        </ul>

        <div className="mt-7 flex justify-end">
          <Button variant="primary" onClick={complete}>
            Get started
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
