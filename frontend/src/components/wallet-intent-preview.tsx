import React from "react";

type WalletIntentPreviewProps = {
  label: string;
  authorizationMessage: string;
  preflight: {
    action: string;
    subject: string;
    summary: string;
    paymentToken: string;
  };
};

export function WalletIntentPreview({
  label,
  authorizationMessage,
  preflight
}: WalletIntentPreviewProps) {
  return (
    <>
      <p className="inline-meta">
        {label}: {preflight.summary}
      </p>
      <p className="inline-meta">Authorization payload: {authorizationMessage}</p>
      <p className="inline-meta">Intent action: {preflight.action}</p>
      <p className="inline-meta">Intent target: {preflight.subject}</p>
      <p className="inline-meta">Settlement token: {preflight.paymentToken}</p>
    </>
  );
}
