import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { expect } from "chai";
import { Noflake } from "../target/types/noflake";

describe("noflake", () => {
  anchor.setProvider(anchor.AnchorProvider.env());

  const provider = anchor.getProvider() as anchor.AnchorProvider;
  const program = anchor.workspace.noflake as Program<Noflake>;
  const strictMode = { strict: {} };
  const partyMode = { party: {} };

  const waitForConfirmation = async (signature: string) => {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const response = await provider.connection.getSignatureStatuses([signature]);
      const status = response.value[0];
      if (status?.err) {
        const error = new Error(
          `transaction failed: ${JSON.stringify(status.err)}`
        ) as Error & {
          customErrorCode?: number;
          transactionError?: unknown;
          transactionLogs?: string[] | null;
        };
        const instructionError =
          (status.err as {
            InstructionError?: [number, { Custom?: number }];
          }).InstructionError ?? [];
        const customError =
          typeof instructionError[1] === "object" &&
          instructionError[1] !== null &&
          "Custom" in instructionError[1]
            ? instructionError[1].Custom
            : undefined;
        const transaction = await provider.connection.getTransaction(signature, {
          commitment: "confirmed",
          maxSupportedTransactionVersion: 0,
        });

        error.customErrorCode = customError;
        error.transactionError = status.err;
        error.transactionLogs = transaction?.meta?.logMessages;
        throw error;
      }
      if (
        status?.confirmationStatus === "confirmed" ||
        status?.confirmationStatus === "finalized"
      ) {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    throw new Error(`timed out waiting for confirmation: ${signature}`);
  };

  const airdrop = async (recipient: anchor.web3.PublicKey, sol = 2) => {
    const signature = await provider.connection.requestAirdrop(
      recipient,
      sol * anchor.web3.LAMPORTS_PER_SOL
    );
    await waitForConfirmation(signature);
  };

  const enumVariant = (value: Record<string, unknown>) => Object.keys(value)[0];

  const expectAnchorError = async (
    promise: Promise<unknown>,
    expectedCode: string
  ) => {
    try {
      await promise;
      expect.fail(`expected Anchor error ${expectedCode}`);
    } catch (error) {
      const anchorError = error as {
        error?: { errorCode?: { code?: string } };
        customErrorCode?: number;
        transactionLogs?: string[];
        message?: string;
        logs?: string[];
      };
      const logs = anchorError.transactionLogs ?? anchorError.logs ?? [];
      const logErrorName = logs
        .map((entry) => entry.match(/Error Code: ([A-Za-z0-9_]+)/)?.[1])
        .find(Boolean);
      const logErrorCode = logs
        .map((entry) => entry.match(/custom program error: (0x[0-9a-f]+)/i)?.[1])
        .find(Boolean);
      const actualCode =
        anchorError.error?.errorCode?.code ??
        logErrorName ??
        anchorError.customErrorCode ??
        (logErrorCode ? Number.parseInt(logErrorCode, 16) : undefined);

      expect(actualCode).to.equal(expectedCode);
    }
  };

  const sendTransaction = async (
    transaction: anchor.web3.Transaction,
    signer: anchor.web3.Keypair
  ) => {
    const { blockhash } = await provider.connection.getLatestBlockhash();
    transaction.feePayer = signer.publicKey;
    transaction.recentBlockhash = blockhash;
    transaction.sign(signer);

    const signature = await provider.connection.sendRawTransaction(
      transaction.serialize()
    );
    await waitForConfirmation(signature);
  };

  const initializeEvent = async ({
    host,
    seatCount,
    settlementMode,
    startTimeValue = 1_800_000_000,
  }: {
    host: anchor.web3.Keypair;
    seatCount: number;
    settlementMode: typeof strictMode | typeof partyMode;
    startTimeValue?: number;
  }) => {
    await airdrop(host.publicKey);

    const title = "NoFlake Shanghai";
    const venue = "West Bund";
    const startTime = new anchor.BN(startTimeValue);
    const cutoffTime = new anchor.BN(1_799_999_000);
    const depositAmount = new anchor.BN(500_000_000);

    const [eventPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("event"),
        host.publicKey.toBuffer(),
        startTime.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );

    const transaction = await program.methods
      .initializeEvent(
        title,
        venue,
        startTime,
        cutoffTime,
        depositAmount,
        seatCount,
        settlementMode
      )
      .accountsPartial({
        host: host.publicKey,
        event: eventPda,
      })
      .transaction();

    await sendTransaction(transaction, host);

    return {
      cutoffTime,
      depositAmount,
      eventPda,
      seatCount,
      startTime,
      title,
      venue,
    };
  };

  const reserveSeat = async (
    eventPda: anchor.web3.PublicKey,
    attendee: anchor.web3.Keypair
  ) => {
    await airdrop(attendee.publicKey);
    const [reservationPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("reservation"),
        eventPda.toBuffer(),
        attendee.publicKey.toBuffer(),
      ],
      program.programId
    );

    const transaction = await program.methods
      .reserveSeat()
      .accountsPartial({
        attendee: attendee.publicKey,
        event: eventPda,
        reservation: reservationPda,
      })
      .transaction();

    await sendTransaction(transaction, attendee);

    return reservationPda;
  };

  it("creates an event account", async () => {
    const host = anchor.web3.Keypair.generate();
    const {
      cutoffTime,
      depositAmount,
      eventPda,
      seatCount,
      startTime,
      title,
      venue,
    } = await initializeEvent({
      host,
      seatCount: 42,
      settlementMode: strictMode,
    });

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
    expect(event.settledCount).to.equal(0);
    expect(enumVariant(event.settlementMode as Record<string, unknown>)).to.equal(
      "strict"
    );
    expect(enumVariant(event.status as Record<string, unknown>)).to.equal("open");
  });

  it("allows the same host to create multiple events", async () => {
    const host = anchor.web3.Keypair.generate();

    const firstEvent = await initializeEvent({
      host,
      seatCount: 42,
      settlementMode: strictMode,
      startTimeValue: 1_800_000_000,
    });
    const secondEvent = await initializeEvent({
      host,
      seatCount: 24,
      settlementMode: partyMode,
      startTimeValue: 1_800_100_000,
    });

    const firstAccount = await program.account.eventAccount.fetch(firstEvent.eventPda);
    const secondAccount = await program.account.eventAccount.fetch(secondEvent.eventPda);

    expect(firstEvent.eventPda.toBase58()).to.not.equal(secondEvent.eventPda.toBase58());
    expect(firstAccount.startTime.toNumber()).to.equal(1_800_000_000);
    expect(secondAccount.startTime.toNumber()).to.equal(1_800_100_000);
  });

  it("waitlists attendees after capacity is reached", async () => {
    const host = anchor.web3.Keypair.generate();
    const attendeeOne = anchor.web3.Keypair.generate();
    const attendeeTwo = anchor.web3.Keypair.generate();

    const { eventPda } = await initializeEvent({
      host,
      seatCount: 1,
      settlementMode: strictMode,
    });

    const firstReservation = await reserveSeat(eventPda, attendeeOne);
    const secondReservation = await reserveSeat(eventPda, attendeeTwo);

    const event = await program.account.eventAccount.fetch(eventPda);
    const reservationOne = await program.account.reservationAccount.fetch(
      firstReservation
    );
    const reservationTwo = await program.account.reservationAccount.fetch(
      secondReservation
    );

    expect(event.reservedCount).to.equal(1);
    expect(enumVariant(event.status as Record<string, unknown>)).to.equal("full");
    expect(enumVariant(reservationOne.status as Record<string, unknown>)).to.equal(
      "reserved"
    );
    expect(enumVariant(reservationTwo.status as Record<string, unknown>)).to.equal(
      "waitlisted"
    );
  });

  it("settles checked-in and no-show reservations in strict mode", async () => {
    const host = anchor.web3.Keypair.generate();
    const attendeeOne = anchor.web3.Keypair.generate();
    const attendeeTwo = anchor.web3.Keypair.generate();

    const { eventPda } = await initializeEvent({
      host,
      seatCount: 2,
      settlementMode: strictMode,
    });

    const firstReservation = await reserveSeat(eventPda, attendeeOne);
    const secondReservation = await reserveSeat(eventPda, attendeeTwo);

    const checkInTransaction = await program.methods
      .checkIn()
        .accountsPartial({
          host: host.publicKey,
          event: eventPda,
          reservation: firstReservation,
        })
      .transaction();
    await sendTransaction(checkInTransaction, host);

    const settleCheckedInTransaction = await program.methods
      .settleReservation()
        .accountsPartial({
          host: host.publicKey,
          event: eventPda,
          reservation: firstReservation,
        })
      .transaction();
    await sendTransaction(settleCheckedInTransaction, host);

    const settleNoShowTransaction = await program.methods
      .settleReservation()
        .accountsPartial({
          host: host.publicKey,
          event: eventPda,
          reservation: secondReservation,
        })
      .transaction();
    await sendTransaction(settleNoShowTransaction, host);

    const finalizeTransaction = await program.methods
      .finalizeEvent()
      .accountsPartial({
        host: host.publicKey,
        event: eventPda,
      })
      .transaction();
    await sendTransaction(finalizeTransaction, host);

    const event = await program.account.eventAccount.fetch(eventPda);
    const reservationOne = await program.account.reservationAccount.fetch(
      firstReservation
    );
    const reservationTwo = await program.account.reservationAccount.fetch(
      secondReservation
    );

    expect(event.checkedInCount).to.equal(1);
    expect(enumVariant(event.status as Record<string, unknown>)).to.equal("settled");
    expect(enumVariant(reservationOne.status as Record<string, unknown>)).to.equal(
      "refunded"
    );
    expect(enumVariant(reservationTwo.status as Record<string, unknown>)).to.equal(
      "forfeited"
    );
  });

  it("marks no-shows without forfeiture in party mode", async () => {
    const host = anchor.web3.Keypair.generate();
    const attendee = anchor.web3.Keypair.generate();

    const { eventPda } = await initializeEvent({
      host,
      seatCount: 1,
      settlementMode: partyMode,
    });
    const reservation = await reserveSeat(eventPda, attendee);

    const settleTransaction = await program.methods
      .settleReservation()
        .accountsPartial({
          host: host.publicKey,
          event: eventPda,
          reservation,
        })
      .transaction();
    await sendTransaction(settleTransaction, host);

    const settledReservation = await program.account.reservationAccount.fetch(
      reservation
    );
    expect(enumVariant(settledReservation.status as Record<string, unknown>)).to.equal(
      "noShow"
    );
  });

  it("rejects settling a waitlisted reservation", async () => {
    const host = anchor.web3.Keypair.generate();
    const attendeeOne = anchor.web3.Keypair.generate();
    const attendeeTwo = anchor.web3.Keypair.generate();

    const { eventPda } = await initializeEvent({
      host,
      seatCount: 1,
      settlementMode: strictMode,
    });

    await reserveSeat(eventPda, attendeeOne);
    const waitlistedReservation = await reserveSeat(eventPda, attendeeTwo);

    const settleTransaction = await program.methods
      .settleReservation()
        .accountsPartial({
          host: host.publicKey,
          event: eventPda,
          reservation: waitlistedReservation,
        })
      .transaction();

    await expectAnchorError(
      sendTransaction(settleTransaction, host),
      "ReservationNotSettleable"
    );
  });

  it("requires settling before finalizing an event", async () => {
    const host = anchor.web3.Keypair.generate();

    const { eventPda } = await initializeEvent({
      host,
      seatCount: 2,
      settlementMode: strictMode,
    });

    const finalizeTransaction = await program.methods
      .finalizeEvent()
      .accountsPartial({
        host: host.publicKey,
        event: eventPda,
      })
      .transaction();

    await expectAnchorError(
      sendTransaction(finalizeTransaction, host),
      "EventNotReadyToFinalize"
    );
  });

  it("does not finalize before all reserved attendees are settled", async () => {
    const host = anchor.web3.Keypair.generate();
    const attendeeOne = anchor.web3.Keypair.generate();
    const attendeeTwo = anchor.web3.Keypair.generate();

    const { eventPda } = await initializeEvent({
      host,
      seatCount: 2,
      settlementMode: strictMode,
    });

    const firstReservation = await reserveSeat(eventPda, attendeeOne);
    await reserveSeat(eventPda, attendeeTwo);

    const settleFirstTransaction = await program.methods
      .settleReservation()
        .accountsPartial({
          host: host.publicKey,
          event: eventPda,
          reservation: firstReservation,
        })
      .transaction();
    await sendTransaction(settleFirstTransaction, host);

    const finalizeTransaction = await program.methods
      .finalizeEvent()
      .accountsPartial({
        host: host.publicKey,
        event: eventPda,
      })
      .transaction();

    await expectAnchorError(
      sendTransaction(finalizeTransaction, host),
      "EventNotReadyToFinalize"
    );
  });

  it("prevents check-in after an event has been finalized", async () => {
    const host = anchor.web3.Keypair.generate();
    const attendeeOne = anchor.web3.Keypair.generate();
    const attendeeTwo = anchor.web3.Keypair.generate();

    const { eventPda } = await initializeEvent({
      host,
      seatCount: 2,
      settlementMode: strictMode,
    });

    const firstReservation = await reserveSeat(eventPda, attendeeOne);
    const secondReservation = await reserveSeat(eventPda, attendeeTwo);

    const settleFirstTransaction = await program.methods
      .settleReservation()
        .accountsPartial({
          host: host.publicKey,
          event: eventPda,
          reservation: firstReservation,
        })
      .transaction();
    await sendTransaction(settleFirstTransaction, host);

    const settleSecondTransaction = await program.methods
      .settleReservation()
        .accountsPartial({
          host: host.publicKey,
          event: eventPda,
          reservation: secondReservation,
        })
      .transaction();
    await sendTransaction(settleSecondTransaction, host);

    const finalizeTransaction = await program.methods
      .finalizeEvent()
      .accountsPartial({
        host: host.publicKey,
        event: eventPda,
      })
      .transaction();
    await sendTransaction(finalizeTransaction, host);

    const checkInTransaction = await program.methods
      .checkIn()
        .accountsPartial({
          host: host.publicKey,
          event: eventPda,
          reservation: firstReservation,
        })
      .transaction();

    await expectAnchorError(sendTransaction(checkInTransaction, host), "EventCheckInClosed");
  });
});
