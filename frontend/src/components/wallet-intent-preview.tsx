import React from "react";

type WalletIntentPreviewProps = {
  label: string;
  preflight: {
    action: string;
    subject: string;
    summary: string;
    paymentToken: string;
  };
};

export function WalletIntentPreview({ label, preflight }: WalletIntentPreviewProps) {
  return (
    <>
      <p className="inline-meta">
        {label}: {preflight.summary}
      </p>
      <p className="inline-meta">Intent action: {preflight.action}</p>
      <p className="inline-meta">Intent target: {preflight.subject}</p>
      <p className="inline-meta">Settlement token: {preflight.paymentToken}</p>
    </>
  );
}
