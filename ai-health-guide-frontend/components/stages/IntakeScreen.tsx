"use client";

import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";

interface IntakeScreenProps {
  /** Current stage label to display while pipeline advances */
  stageLabel?: string;
}

export const IntakeScreen = ({ stageLabel = "Intake" }: IntakeScreenProps) => (
  <div className="flex flex-col items-center gap-6 pt-8">
    <Card className="w-full max-w-lg">
      <CardHeader>
        <p className="font-semibold text-gray-700">{stageLabel}</p>
      </CardHeader>
      <CardBody className="flex flex-col items-center gap-4 py-8">
        <Spinner size="lg" />
        <p className="text-sm text-gray-500">
          Connecting you to the health assistant…
        </p>
      </CardBody>
    </Card>
  </div>
);
