import { useState } from "react";
import { WelcomeStep } from "@/components/welcome/WelcomeStep";
import { ToolDetectionStep } from "@/components/welcome/ToolDetectionStep";
import { DirectorySetupStep } from "@/components/welcome/DirectorySetupStep";
import { ImportSkillsStep } from "@/components/welcome/ImportSkillsStep";

type WizardStep = "welcome" | "tools" | "directory" | "import";

interface WelcomeProps {
  onComplete: () => void;
}

export function Welcome({ onComplete }: WelcomeProps) {
  const [currentStep, setCurrentStep] = useState<WizardStep>("welcome");

  const steps: WizardStep[] = ["welcome", "tools", "directory", "import"];
  const currentIndex = steps.indexOf(currentStep);

  function goNext() {
    if (currentIndex < steps.length - 1) {
      setCurrentStep(steps[currentIndex + 1]);
    } else {
      onComplete();
    }
  }

  function goBack() {
    if (currentIndex > 0) {
      setCurrentStep(steps[currentIndex - 1]);
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-8">
      <div className="w-full max-w-2xl">
        {/* Progress indicator */}
        <div className="flex justify-center mb-8">
          {steps.map((step, index) => (
            <div key={step} className="flex items-center">
              <div
                className={`w-3 h-3 rounded-full ${
                  index <= currentIndex ? "bg-primary" : "bg-muted"
                }`}
              />
              {index < steps.length - 1 && (
                <div
                  className={`w-12 h-0.5 ${
                    index < currentIndex ? "bg-primary" : "bg-muted"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step content */}
        {currentStep === "welcome" && <WelcomeStep onNext={goNext} />}
        {currentStep === "tools" && (
          <ToolDetectionStep onNext={goNext} onBack={goBack} />
        )}
        {currentStep === "directory" && (
          <DirectorySetupStep onNext={goNext} onBack={goBack} />
        )}
        {currentStep === "import" && (
          <ImportSkillsStep onNext={goNext} onBack={goBack} />
        )}
      </div>
    </div>
  );
}
