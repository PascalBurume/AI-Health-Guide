"use client";

import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { useUIStore } from "@/store";

const LANGUAGES: { code: string; label: string; native: string }[] = [
  { code: "en", label: "English", native: "English" },
  { code: "fr", label: "French", native: "Français" },
  { code: "es", label: "Spanish", native: "Español" },
  { code: "ar", label: "Arabic", native: "العربية" },
  { code: "ja", label: "Japanese", native: "日本語" },
  { code: "sw", label: "Swahili", native: "Kiswahili" },
];

interface WelcomeScreenProps {
  onStart: () => void;
  isLoading?: boolean;
}

export const WelcomeScreen = ({ onStart, isLoading }: WelcomeScreenProps) => {
  const locale = useUIStore((s) => s.locale);
  const setLocale = useUIStore((s) => s.setLocale);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-8 px-4 text-center">
      <div className="flex flex-col items-center gap-3">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-blue-100 text-4xl">
          🏥
        </div>
        <h1 className="text-3xl font-bold text-gray-900">AI Health Guide</h1>
        <p className="max-w-md text-gray-500">
          A multilingual clinical triage assistant. Describe your symptoms and
          get directed to the appropriate level of care.
        </p>
      </div>

      {/* Language selector */}
      <div className="w-full max-w-sm">
        <p className="mb-2 text-sm font-medium text-gray-600">Choose your language</p>
        <div className="flex flex-wrap justify-center gap-2">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              onClick={() => setLocale(lang.code, lang.code === "ar")}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                locale === lang.code
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {lang.native}
            </button>
          ))}
        </div>
      </div>

      <Card className="w-full max-w-sm text-start">
        <CardHeader>
          <p className="text-sm font-semibold text-gray-700">⚠️ Important notice</p>
        </CardHeader>
        <CardBody>
          <p className="text-xs text-gray-500">
            This tool does <strong>not</strong> replace professional medical advice,
            diagnosis, or treatment. In an emergency, call your local emergency
            services immediately.
          </p>
        </CardBody>
      </Card>

      <Button size="lg" onClick={onStart} isLoading={isLoading}>
        Start consultation
      </Button>
    </div>
  );
};
