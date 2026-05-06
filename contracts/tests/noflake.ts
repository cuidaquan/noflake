import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { expect } from "chai";
import { Noflake } from "../target/types/noflake";

describe("noflake", () => {
  anchor.setProvider(anchor.AnchorProvider.env());

  const provider = anchor.getProvider() as anchor.AnchorProvider;
  const program = anchor.workspace.noflake as Program<Noflake>;

  const waitForConfirmation = async (signature: string) => {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const response = await provider.connection.getSignatureStatuses([signature]);
      const status = response.value[0];
      if (status?.err) {
        throw new Error(`transaction failed: ${JSON.stringify(status.err)}`);
      }
      if (status?.confirmationStatus === "confirmed" || status?.confirmationStatus === "finalized") {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    throw new Error(`timed out waiting for confirmation: ${signature}`);
  };

  it("creates an event account", async () => {
    const host = anchor.web3.Keypair.generate();
    const title = "NoFlake Shanghai";
    const venue = "West Bund";
    const startTime = new anchor.BN(1_800_000_000);
    const cutoffTime = new anchor.BN(1_799_999_000);
    const depositAmount = new anchor.BN(500_000_000);
    const seatCount = 42;

    const signature = await provider.connection.requestAirdrop(
      host.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    );
    await waitForConfirmation(signature);

    const [eventPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("event"), host.publicKey.toBuffer()],
      program.programId
    );

    const transaction = await program.methods
      .initializeEvent(
        title,
        venue,
        startTime,
        cutoffTime,
        depositAmount,
        seatCount
      )
      .accountsPartial({
        host: host.publicKey,
        event: eventPda,
      })
      .transaction();

    const { blockhash } = await provider.connection.getLatestBlockhash();
    transaction.feePayer = host.publicKey;
    transaction.recentBlockhash = blockhash;
    transaction.sign(host);

    const txSignature = await provider.connection.sendRawTransaction(
      transaction.serialize()
    );
    await waitForConfirmation(txSignature);

    const event = await program.account.eventAccount.fetch(eventPda);
    expect(event.host.toBase58()).to.equal(host.publicKey.toBase58());
    expect(event.title).to.equal(title);
    expect(event.venue).to.equal(venue);
    expect(event.startTime.toNumber()).to.equal(startTime.toNumber());
    expect(event.cutoffTime.toNumber()).to.equal(cutoffTime.toNumber());
    expect(event.depositAmount.toString()).to.equal(depositAmount.toString());
    expect(event.seatCount).to.equal(seatCount);
    expect(event.reservedCount).to.equal(0);
    expect(event.checkedInCount).to.equal(0);
  });
});
