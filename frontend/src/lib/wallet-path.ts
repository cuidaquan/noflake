type CurrentWalletPathInput = {
  walletAddress: string | null;
  isDemoWallet: boolean;
  browserWalletAvailable: boolean;
};

export function formatCurrentReservationPathLabel({
  walletAddress,
  isDemoWallet,
  browserWalletAvailable
}: CurrentWalletPathInput) {
  if (walletAddress) {
    return isDemoWallet ? "Demo backend reservation" : "Browser wallet connected";
  }

  return browserWalletAvailable ? "Browser wallet available" : "Demo backend reservation";
}

export function formatCurrentHostPathLabel({
  walletAddress,
  isDemoWallet,
  browserWalletAvailable
}: CurrentWalletPathInput) {
  if (walletAddress) {
    return isDemoWallet ? "Demo backend host" : "Browser wallet connected";
  }

  return browserWalletAvailable ? "Browser wallet available" : "Demo backend host";
}
