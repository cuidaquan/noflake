import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import {
  createAssociatedTokenAccountInstruction,
  createInitializeMint2Instruction,
  createMintToInstruction,
  getAccount,
  getAssociatedTokenAddressSync,
  MINT_SIZE,
  TOKEN_PROGRAM_ID
} from "@solana/spl-token";
import { expect } from "chai";
import { Noflake } from "../target/types/noflake";

describe("noflake", () => {
  anchor.setProvider(anchor.AnchorProvider.env());

  const provider = anchor.getProvider() as anchor.AnchorProvider;
  const program = anchor.workspace.noflake as Program<Noflake>;
  const strictMode = { strict: {} };
  const partyMode = { party: {} };
  const sponsorMode = { sponsor: {} };
  const eventFundingConfig = new Map<
    string,
    {
      depositMint: anchor.web3.PublicKey;
      mintAuthority: anchor.web3.Keypair;
      eventVaultAta: anchor.web3.PublicKey;
      vaultAuthorityPda: anchor.web3.PublicKey;
    }
  >();
  const sponsorFundingConfig = new Map<
    string,
    {
      sponsorVaultAta: anchor.web3.PublicKey;
      sponsorVaultAuthorityPda: anchor.web3.PublicKey;
      sponsorSourceAta: anchor.web3.PublicKey;
      sponsorMintAuthority: anchor.web3.Keypair;
    }
  >();

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

  const createMint = async (authority: anchor.web3.Keypair, decimals = 6) => {
    const mint = anchor.web3.Keypair.generate();
    const lamports = await provider.connection.getMinimumBalanceForRentExemption(
      MINT_SIZE
    );
    const transaction = new anchor.web3.Transaction().add(
      anchor.web3.SystemProgram.createAccount({
        fromPubkey: authority.publicKey,
        newAccountPubkey: mint.publicKey,
        space: MINT_SIZE,
        lamports,
        programId: TOKEN_PROGRAM_ID
      }),
      createInitializeMint2Instruction(
        mint.publicKey,
        decimals,
        authority.publicKey,
        null
      )
    );

    transaction.feePayer = authority.publicKey;
    const { blockhash } = await provider.connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.partialSign(authority, mint);

    const signature = await provider.connection.sendRawTransaction(
      transaction.serialize()
    );
    await waitForConfirmation(signature);
    return mint.publicKey;
  };

  const createAta = async (
    payer: anchor.web3.Keypair,
    mint: anchor.web3.PublicKey,
    owner: anchor.web3.PublicKey
  ) => {
    const ata = getAssociatedTokenAddressSync(mint, owner);
    const accountInfo = await provider.connection.getAccountInfo(ata);

    if (accountInfo) {
      return ata;
    }

    const transaction = new anchor.web3.Transaction().add(
      createAssociatedTokenAccountInstruction(
        payer.publicKey,
        ata,
        owner,
        mint
      )
    );

    await sendTransaction(transaction, payer);
    return ata;
  };

  const mintToAta = async ({
    authority,
    mint,
    destination,
    amount,
  }: {
    authority: anchor.web3.Keypair;
    mint: anchor.web3.PublicKey;
    destination: anchor.web3.PublicKey;
    amount: bigint;
  }) => {
    const transaction = new anchor.web3.Transaction().add(
      createMintToInstruction(
        mint,
        destination,
        authority.publicKey,
        amount
      )
    );

    await sendTransaction(transaction, authority);
  };

  const getTokenBalance = async (account: anchor.web3.PublicKey) => {
    const tokenAccount = await getAccount(provider.connection, account);
    return tokenAccount.amount;
  };

  const getFundingConfig = (eventPda: anchor.web3.PublicKey) => {
    const fundingConfig = eventFundingConfig.get(eventPda.toBase58());

    if (!fundingConfig) {
      throw new Error(`missing funding config for event ${eventPda.toBase58()}`);
    }

    return fundingConfig;
  };

  const getSponsorFundingConfig = (eventPda: anchor.web3.PublicKey) => {
    const config = sponsorFundingConfig.get(eventPda.toBase58());

    if (!config) {
      throw new Error(`missing sponsor funding config for event ${eventPda.toBase58()}`);
    }

    return config;
  };

  const getAttendeeDepositAta = (
    eventPda: anchor.web3.PublicKey,
    attendee: anchor.web3.PublicKey
  ) => {
    const fundingConfig = getFundingConfig(eventPda);
    return getAssociatedTokenAddressSync(fundingConfig.depositMint, attendee);
  };

  const waitForUnixTime = async (targetUnixTime: number) => {
    for (let attempt = 0; attempt < 60; attempt += 1) {
      const clock = await provider.connection.getBlockTime(
        await provider.connection.getSlot("confirmed")
      );
      if (clock !== null && clock >= targetUnixTime) {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    throw new Error(`timed out waiting for unix time ${targetUnixTime}`);
  };

  const getCurrentUnixTime = async () => {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const clock = await provider.connection.getBlockTime(
        await provider.connection.getSlot("confirmed")
      );
      if (clock !== null) {
        return clock;
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    throw new Error("unable to determine current unix time");
  };

  const initializeEvent = async ({
    host,
    seatCount,
    settlementMode,
    depositMint,
    startTimeValue = 1_800_000_000,
    cutoffTimeValue = startTimeValue - 1_000,
  }: {
    host: anchor.web3.Keypair;
    seatCount: number;
    settlementMode: typeof strictMode | typeof partyMode;
    depositMint?: anchor.web3.PublicKey;
    startTimeValue?: number;
    cutoffTimeValue?: number;
  }) => {
    await airdrop(host.publicKey);
    const resolvedDepositMint = depositMint ?? (await createMint(host));

    const title = "NoFlake Shanghai";
    const venue = "West Bund";
    const startTime = new anchor.BN(startTimeValue);
    const cutoffTime = new anchor.BN(cutoffTimeValue);
    const depositAmount = new anchor.BN(500_000_000);

    const [eventPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("event"),
        host.publicKey.toBuffer(),
        startTime.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );

    const [vaultAuthorityPda, vaultAuthorityBump] =
      anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), eventPda.toBuffer()],
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
        settlementMode,
        resolvedDepositMint
      )
      .accountsPartial({
        host: host.publicKey,
        event: eventPda,
        vaultAuthority: vaultAuthorityPda,
        depositMintAccount: resolvedDepositMint,
        eventVaultToken: getAssociatedTokenAddressSync(
          resolvedDepositMint,
          vaultAuthorityPda,
          true
        ),
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
      })
      .transaction();

    await sendTransaction(transaction, host);

    const eventVaultAta = getAssociatedTokenAddressSync(
      resolvedDepositMint,
      vaultAuthorityPda,
      true
    );
    eventFundingConfig.set(eventPda.toBase58(), {
      depositMint: resolvedDepositMint,
      mintAuthority: host,
      eventVaultAta,
      vaultAuthorityPda
    });

    return {
      cutoffTime,
      depositAmount,
      depositMint: resolvedDepositMint,
      eventPda,
      eventVaultAta,
      seatCount,
      startTime,
      title,
      vaultAuthorityBump,
      vaultAuthorityPda,
      venue,
    };
  };

  const reserveSeat = async (
    eventPda: anchor.web3.PublicKey,
    attendee: anchor.web3.Keypair,
    depositMint?: anchor.web3.PublicKey
  ) => {
    await airdrop(attendee.publicKey);
    const fundingConfig = eventFundingConfig.get(eventPda.toBase58());
    const resolvedDepositMint = depositMint ?? fundingConfig?.depositMint;

    if (!resolvedDepositMint || !fundingConfig) {
      throw new Error(`missing funding config for event ${eventPda.toBase58()}`);
    }

    const [reservationPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("reservation"),
        eventPda.toBuffer(),
        attendee.publicKey.toBuffer(),
      ],
      program.programId
    );

    const attendeeDepositAta = await createAta(
      attendee,
      resolvedDepositMint,
      attendee.publicKey
    );
    const attendeeBalanceBeforeReserve = await getTokenBalance(attendeeDepositAta);
    if (attendeeBalanceBeforeReserve < 1_000_000_000n) {
      await mintToAta({
        authority: fundingConfig.mintAuthority,
        mint: resolvedDepositMint,
        destination: attendeeDepositAta,
        amount: 1_000_000_000n - attendeeBalanceBeforeReserve
      });
    }

    const transaction = await program.methods
      .reserveSeat()
      .accountsPartial({
        attendee: attendee.publicKey,
        event: eventPda,
        reservation: reservationPda,
        attendeeDepositToken: attendeeDepositAta,
        eventVaultToken: fundingConfig.eventVaultAta,
        vaultAuthority: fundingConfig.vaultAuthorityPda,
        depositMintAccount: resolvedDepositMint,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .transaction();

    await sendTransaction(transaction, attendee);

    return reservationPda;
  };

  const cancelReservation = async ({
    host,
    eventPda,
    reservationPda,
    promotedReservationPda,
  }: {
    host: anchor.web3.Keypair;
    eventPda: anchor.web3.PublicKey;
    reservationPda: anchor.web3.PublicKey;
    promotedReservationPda?: anchor.web3.PublicKey;
  }) => {
    const fundingConfig = getFundingConfig(eventPda);
    const reservation = await program.account.reservationAccount.fetch(reservationPda);
    const attendeeDepositAta = getAssociatedTokenAddressSync(
      fundingConfig.depositMint,
      reservation.attendee
    );

    const transaction = await program.methods
      .cancelReservation()
      .accountsPartial({
        host: host.publicKey,
        event: eventPda,
        vaultAuthority: fundingConfig.vaultAuthorityPda,
        depositMintAccount: fundingConfig.depositMint,
        eventVaultToken: fundingConfig.eventVaultAta,
        attendeeDepositToken: attendeeDepositAta,
        reservation: reservationPda,
        promotedReservation: promotedReservationPda ?? null,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .transaction();

    await sendTransaction(transaction, host);
  };

  const buildSettleReservationTransaction = async ({
    host,
    eventPda,
    reservationPda,
  }: {
    host: anchor.web3.Keypair;
    eventPda: anchor.web3.PublicKey;
    reservationPda: anchor.web3.PublicKey;
  }) => {
    const fundingConfig = getFundingConfig(eventPda);
    const reservation = await program.account.reservationAccount.fetch(reservationPda);
    const hostDepositAta = await createAta(
      host,
      fundingConfig.depositMint,
      host.publicKey
    );
    const attendeeDepositAta = getAssociatedTokenAddressSync(
      fundingConfig.depositMint,
      reservation.attendee
    );

    return program.methods
      .settleReservation()
      .accountsPartial({
        host: host.publicKey,
        event: eventPda,
        vaultAuthority: fundingConfig.vaultAuthorityPda,
        depositMintAccount: fundingConfig.depositMint,
        eventVaultToken: fundingConfig.eventVaultAta,
        attendeeDepositToken: attendeeDepositAta,
        hostDepositToken: hostDepositAta,
        reservation: reservationPda,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .transaction();
  };

  const settleReservation = async ({
    host,
    eventPda,
    reservationPda,
  }: {
    host: anchor.web3.Keypair;
    eventPda: anchor.web3.PublicKey;
    reservationPda: anchor.web3.PublicKey;
  }) => {
    const transaction = await buildSettleReservationTransaction({
      host,
      eventPda,
      reservationPda,
    });

    await sendTransaction(transaction, host);
  };

  const buildPreparePartyDistributionTransaction = async ({
    host,
    eventPda,
  }: {
    host: anchor.web3.Keypair;
    eventPda: anchor.web3.PublicKey;
  }) => {
    const fundingConfig = getFundingConfig(eventPda);
    const hostDepositAta = await createAta(
      host,
      fundingConfig.depositMint,
      host.publicKey
    );

    return program.methods
      .preparePartyDistribution()
      .accountsPartial({
        host: host.publicKey,
        event: eventPda,
        vaultAuthority: fundingConfig.vaultAuthorityPda,
        depositMintAccount: fundingConfig.depositMint,
        eventVaultToken: fundingConfig.eventVaultAta,
        hostDepositToken: hostDepositAta,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .transaction();
  };

  const buildClaimPartyBonusTransaction = async ({
    attendee,
    eventPda,
    reservationPda,
  }: {
    attendee: anchor.web3.Keypair;
    eventPda: anchor.web3.PublicKey;
    reservationPda: anchor.web3.PublicKey;
  }) => {
    const fundingConfig = getFundingConfig(eventPda);
    const attendeeDepositAta = await createAta(
      attendee,
      fundingConfig.depositMint,
      attendee.publicKey
    );

    return program.methods
      .claimPartyBonus()
      .accountsPartial({
        attendee: attendee.publicKey,
        event: eventPda,
        reservation: reservationPda,
        vaultAuthority: fundingConfig.vaultAuthorityPda,
        depositMintAccount: fundingConfig.depositMint,
        eventVaultToken: fundingConfig.eventVaultAta,
        attendeeDepositToken: attendeeDepositAta,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .transaction();
  };

  const claimPartyBonus = async ({
    attendee,
    eventPda,
    reservationPda,
  }: {
    attendee: anchor.web3.Keypair;
    eventPda: anchor.web3.PublicKey;
    reservationPda: anchor.web3.PublicKey;
  }) => {
    const transaction = await buildClaimPartyBonusTransaction({
      attendee,
      eventPda,
      reservationPda,
    });

    await sendTransaction(transaction, attendee);
  };

  const setupSponsorFunding = async ({
    sponsor,
    eventPda,
    amount,
  }: {
    sponsor: anchor.web3.Keypair;
    eventPda: anchor.web3.PublicKey;
    amount: bigint;
  }) => {
    await airdrop(sponsor.publicKey);
    const fundingConfig = getFundingConfig(eventPda);
    const sponsorSourceAta = await createAta(
      sponsor,
      fundingConfig.depositMint,
      sponsor.publicKey
    );
    const sponsorSourceBalance = await getTokenBalance(sponsorSourceAta);
    if (sponsorSourceBalance < amount) {
      await mintToAta({
        authority: fundingConfig.mintAuthority,
        mint: fundingConfig.depositMint,
        destination: sponsorSourceAta,
        amount: amount - sponsorSourceBalance,
      });
    }

    const [sponsorVaultAuthorityPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("sponsor-vault"), eventPda.toBuffer()],
      program.programId
    );
    const sponsorVaultAta = getAssociatedTokenAddressSync(
      fundingConfig.depositMint,
      sponsorVaultAuthorityPda,
      true
    );

    sponsorFundingConfig.set(eventPda.toBase58(), {
      sponsorVaultAta,
      sponsorVaultAuthorityPda,
      sponsorSourceAta,
      sponsorMintAuthority: fundingConfig.mintAuthority,
    });

    return {
      sponsorSourceAta,
      sponsorVaultAta,
      sponsorVaultAuthorityPda,
    };
  };

  const buildFundSponsorPoolTransaction = async ({
    sponsor,
    eventPda,
    amount,
  }: {
    sponsor: anchor.web3.Keypair;
    eventPda: anchor.web3.PublicKey;
    amount: bigint;
  }) => {
    const fundingConfig = getFundingConfig(eventPda);
    const sponsorConfig = getSponsorFundingConfig(eventPda);

    return program.methods
      .fundSponsorPool(new anchor.BN(amount.toString()))
      .accountsPartial({
        sponsor: sponsor.publicKey,
        event: eventPda,
        sponsorVaultAuthority: sponsorConfig.sponsorVaultAuthorityPda,
        depositMintAccount: fundingConfig.depositMint,
        sponsorSourceToken: sponsorConfig.sponsorSourceAta,
        sponsorVaultToken: sponsorConfig.sponsorVaultAta,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
      })
      .transaction();
  };

  const fundSponsorPool = async ({
    sponsor,
    eventPda,
    amount,
  }: {
    sponsor: anchor.web3.Keypair;
    eventPda: anchor.web3.PublicKey;
    amount: bigint;
  }) => {
    const transaction = await buildFundSponsorPoolTransaction({
      sponsor,
      eventPda,
      amount,
    });

    await sendTransaction(transaction, sponsor);
  };

  const buildRefundCancelledSponsorPoolTransaction = async ({
    sponsor,
    eventPda,
  }: {
    sponsor: anchor.web3.Keypair;
    eventPda: anchor.web3.PublicKey;
  }) => {
    const fundingConfig = getFundingConfig(eventPda);
    const sponsorConfig = getSponsorFundingConfig(eventPda);

    return program.methods
      .refundCancelledSponsorPool()
      .accountsPartial({
        sponsor: sponsor.publicKey,
        event: eventPda,
        sponsorVaultAuthority: sponsorConfig.sponsorVaultAuthorityPda,
        depositMintAccount: fundingConfig.depositMint,
        sponsorSourceToken: sponsorConfig.sponsorSourceAta,
        sponsorVaultToken: sponsorConfig.sponsorVaultAta,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .transaction();
  };

  const refundCancelledSponsorPool = async ({
    sponsor,
    eventPda,
  }: {
    sponsor: anchor.web3.Keypair;
    eventPda: anchor.web3.PublicKey;
  }) => {
    const transaction = await buildRefundCancelledSponsorPoolTransaction({
      sponsor,
      eventPda,
    });

    await sendTransaction(transaction, sponsor);
  };

  const buildPrepareSponsorDistributionTransaction = async ({
    host,
    eventPda,
    sponsor,
  }: {
    host: anchor.web3.Keypair;
    eventPda: anchor.web3.PublicKey;
    sponsor: anchor.web3.Keypair;
  }) => {
    const fundingConfig = getFundingConfig(eventPda);
    const sponsorConfig = getSponsorFundingConfig(eventPda);

    return program.methods
      .prepareSponsorDistribution()
      .accountsPartial({
        host: host.publicKey,
        event: eventPda,
        sponsor: sponsor.publicKey,
        sponsorVaultAuthority: sponsorConfig.sponsorVaultAuthorityPda,
        depositMintAccount: fundingConfig.depositMint,
        sponsorVaultToken: sponsorConfig.sponsorVaultAta,
        sponsorReturnToken: sponsorConfig.sponsorSourceAta,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .transaction();
  };

  const buildClaimSponsorBonusTransaction = async ({
    attendee,
    eventPda,
    reservationPda,
  }: {
    attendee: anchor.web3.Keypair;
    eventPda: anchor.web3.PublicKey;
    reservationPda: anchor.web3.PublicKey;
  }) => {
    const fundingConfig = getFundingConfig(eventPda);
    const sponsorConfig = getSponsorFundingConfig(eventPda);
    const attendeeDepositAta = await createAta(
      attendee,
      fundingConfig.depositMint,
      attendee.publicKey
    );

    return program.methods
      .claimSponsorBonus()
      .accountsPartial({
        attendee: attendee.publicKey,
        event: eventPda,
        reservation: reservationPda,
        sponsorVaultAuthority: sponsorConfig.sponsorVaultAuthorityPda,
        depositMintAccount: fundingConfig.depositMint,
        sponsorVaultToken: sponsorConfig.sponsorVaultAta,
        attendeeDepositToken: attendeeDepositAta,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .transaction();
  };

  const claimSponsorBonus = async ({
    attendee,
    eventPda,
    reservationPda,
  }: {
    attendee: anchor.web3.Keypair;
    eventPda: anchor.web3.PublicKey;
    reservationPda: anchor.web3.PublicKey;
  }) => {
    const transaction = await buildClaimSponsorBonusTransaction({
      attendee,
      eventPda,
      reservationPda,
    });

    await sendTransaction(transaction, attendee);
  };

  const undoCheckIn = async ({
    host,
    eventPda,
    reservationPda,
  }: {
    host: anchor.web3.Keypair;
    eventPda: anchor.web3.PublicKey;
    reservationPda: anchor.web3.PublicKey;
  }) => {
    const transaction = await program.methods
      .undoCheckIn()
      .accountsPartial({
        host: host.publicKey,
        event: eventPda,
        reservation: reservationPda,
      })
      .transaction();

    await sendTransaction(transaction, host);
  };

  const cancelEvent = async ({
    host,
    eventPda,
  }: {
    host: anchor.web3.Keypair;
    eventPda: anchor.web3.PublicKey;
  }) => {
    const transaction = await program.methods
      .cancelEvent()
      .accountsPartial({
        host: host.publicKey,
        event: eventPda,
      })
      .transaction();

    await sendTransaction(transaction, host);
  };

  it("creates an event account", async () => {
    const host = anchor.web3.Keypair.generate();
    const {
      cutoffTime,
      depositAmount,
      depositMint,
      eventPda,
      seatCount,
      startTime,
      title,
      vaultAuthorityBump,
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
    expect(event.depositMint.toBase58()).to.equal(depositMint.toBase58());
    expect(event.seatCount).to.equal(seatCount);
    expect(event.reservedCount).to.equal(0);
    expect(event.checkedInCount).to.equal(0);
    expect(event.settledCount).to.equal(0);
    expect(event.vaultAuthorityBump).to.equal(vaultAuthorityBump);
    expect(enumVariant(event.settlementMode as Record<string, unknown>)).to.equal(
      "strict"
    );
    expect(enumVariant(event.status as Record<string, unknown>)).to.equal("open");
  });

  it("locks the attendee deposit in the event vault when reserving a seat", async () => {
    const host = anchor.web3.Keypair.generate();
    const attendee = anchor.web3.Keypair.generate();
    await airdrop(host.publicKey);
    await airdrop(attendee.publicKey);

    const depositMint = await createMint(host);
    const attendeeDepositAta = await createAta(attendee, depositMint, attendee.publicKey);
    await mintToAta({
      authority: host,
      mint: depositMint,
      destination: attendeeDepositAta,
      amount: 1_000_000_000n
    });

    const { depositAmount, eventPda } = await initializeEvent({
      host,
      seatCount: 2,
      settlementMode: strictMode,
      depositMint
    });

    const [vaultAuthorityPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), eventPda.toBuffer()],
      program.programId
    );
    const eventVaultAta = getAssociatedTokenAddressSync(
      depositMint,
      vaultAuthorityPda,
      true
    );

    const attendeeBalanceBefore = await getTokenBalance(attendeeDepositAta);

    await reserveSeat(eventPda, attendee, depositMint);

    const attendeeBalanceAfter = await getTokenBalance(attendeeDepositAta);
    const eventVaultBalance = await getTokenBalance(eventVaultAta);

    expect(attendeeBalanceBefore - attendeeBalanceAfter).to.equal(BigInt(depositAmount.toString()));
    expect(eventVaultBalance).to.equal(BigInt(depositAmount.toString()));
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

  it("promotes the earliest waitlisted attendee after a cancellation", async () => {
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
    const fundingConfig = getFundingConfig(eventPda);
    const attendeeOneDepositAta = getAttendeeDepositAta(eventPda, attendeeOne.publicKey);
    const attendeeTwoDepositAta = getAttendeeDepositAta(eventPda, attendeeTwo.publicKey);
    const attendeeOneBalanceBeforeCancel = await getTokenBalance(attendeeOneDepositAta);
    const attendeeTwoBalanceBeforeCancel = await getTokenBalance(attendeeTwoDepositAta);
    const eventVaultBalanceBeforeCancel = await getTokenBalance(fundingConfig.eventVaultAta);

    await cancelReservation({
      host,
      eventPda,
      reservationPda: firstReservation,
      promotedReservationPda: secondReservation,
    });

    const event = await program.account.eventAccount.fetch(eventPda);
    const cancelledReservation = await program.account.reservationAccount.fetch(
      firstReservation
    );
    const promotedReservation = await program.account.reservationAccount.fetch(
      secondReservation
    );
    const attendeeOneBalanceAfterCancel = await getTokenBalance(attendeeOneDepositAta);
    const attendeeTwoBalanceAfterCancel = await getTokenBalance(attendeeTwoDepositAta);
    const eventVaultBalanceAfterCancel = await getTokenBalance(fundingConfig.eventVaultAta);

    expect(enumVariant(cancelledReservation.status as Record<string, unknown>)).to.equal(
      "cancelled"
    );
    expect(enumVariant(promotedReservation.status as Record<string, unknown>)).to.equal(
      "reserved"
    );
    expect(event.reservedCount).to.equal(1);
    expect(attendeeOneBalanceAfterCancel - attendeeOneBalanceBeforeCancel).to.equal(500_000_000n);
    expect(attendeeTwoBalanceAfterCancel).to.equal(attendeeTwoBalanceBeforeCancel);
    expect(eventVaultBalanceBeforeCancel - eventVaultBalanceAfterCancel).to.equal(500_000_000n);
  });

  it("does not count cancelled reservations toward finalization readiness", async () => {
    const host = anchor.web3.Keypair.generate();
    const attendeeOne = anchor.web3.Keypair.generate();
    const attendeeTwo = anchor.web3.Keypair.generate();
    const cutoffTimeValue = (await getCurrentUnixTime()) + 10;

    const { eventPda } = await initializeEvent({
      host,
      seatCount: 2,
      settlementMode: strictMode,
      startTimeValue: 1_700_000_000,
      cutoffTimeValue,
    });

    const firstReservation = await reserveSeat(eventPda, attendeeOne);
    const secondReservation = await reserveSeat(eventPda, attendeeTwo);

    await cancelReservation({
      host,
      eventPda,
      reservationPda: secondReservation,
    });

    await waitForUnixTime(cutoffTimeValue);

    const settleTransaction = await buildSettleReservationTransaction({
      host,
      eventPda,
      reservationPda: firstReservation,
    });
    await sendTransaction(settleTransaction, host);

    const finalizeTransaction = await program.methods
      .finalizeEvent()
      .accountsPartial({
        host: host.publicKey,
        event: eventPda,
      })
      .transaction();
    await sendTransaction(finalizeTransaction, host);

    const event = await program.account.eventAccount.fetch(eventPda);
    expect(enumVariant(event.status as Record<string, unknown>)).to.equal("settled");
  });

  it("rejects cancelling a reservation after settlement has started", async () => {
    const host = anchor.web3.Keypair.generate();
    const attendeeOne = anchor.web3.Keypair.generate();
    const attendeeTwo = anchor.web3.Keypair.generate();
    const cutoffTimeValue = (await getCurrentUnixTime()) + 10;

    const { eventPda } = await initializeEvent({
      host,
      seatCount: 2,
      settlementMode: strictMode,
      startTimeValue: 1_700_000_000,
      cutoffTimeValue,
    });

    const firstReservation = await reserveSeat(eventPda, attendeeOne);
    const secondReservation = await reserveSeat(eventPda, attendeeTwo);

    await waitForUnixTime(cutoffTimeValue);

    const settleTransaction = await buildSettleReservationTransaction({
      host,
      eventPda,
      reservationPda: firstReservation,
    });
    await sendTransaction(settleTransaction, host);

    await expectAnchorError(
      cancelReservation({
        host,
        eventPda,
        reservationPda: secondReservation,
      }),
      "ReservationNotCancellable"
    );
  });

  it("does not allow cancelling a reservation after the cutoff time", async () => {
    const host = anchor.web3.Keypair.generate();
    const attendee = anchor.web3.Keypair.generate();

    const { eventPda } = await initializeEvent({
      host,
      seatCount: 1,
      settlementMode: strictMode,
      startTimeValue: 4_102_444_800,
      cutoffTimeValue: 1_700_000_000,
    });

    const reservation = await reserveSeat(eventPda, attendee);

    await expectAnchorError(
      cancelReservation({
        host,
        eventPda,
        reservationPda: reservation,
      }),
      "ReservationCancellationClosed"
    );
  });

  it("allows a host to undo a check-in before settlement starts", async () => {
    const host = anchor.web3.Keypair.generate();
    const attendee = anchor.web3.Keypair.generate();

    const { eventPda } = await initializeEvent({
      host,
      seatCount: 1,
      settlementMode: strictMode,
    });

    const reservation = await reserveSeat(eventPda, attendee);

    const checkInTransaction = await program.methods
      .checkIn()
      .accountsPartial({
        host: host.publicKey,
        event: eventPda,
        reservation,
      })
      .transaction();
    await sendTransaction(checkInTransaction, host);

    await undoCheckIn({
      host,
      eventPda,
      reservationPda: reservation,
    });

    const event = await program.account.eventAccount.fetch(eventPda);
    const reservationAccount = await program.account.reservationAccount.fetch(
      reservation
    );

    expect(event.checkedInCount).to.equal(0);
    expect(enumVariant(reservationAccount.status as Record<string, unknown>)).to.equal(
      "reserved"
    );
    expect(enumVariant(event.status as Record<string, unknown>)).to.equal("full");
  });

  it("allows a host to cancel an event before settlement and marks the event cancelled", async () => {
    const host = anchor.web3.Keypair.generate();
    const attendee = anchor.web3.Keypair.generate();

    const { eventPda } = await initializeEvent({
      host,
      seatCount: 1,
      settlementMode: strictMode,
    });

    await reserveSeat(eventPda, attendee);

    await cancelEvent({
      host,
      eventPda,
    });

    const event = await program.account.eventAccount.fetch(eventPda);
    expect(enumVariant(event.status as Record<string, unknown>)).to.equal("cancelled");
  });

  it("refunds reserved, checked-in, and waitlisted reservations after event cancellation", async () => {
    const host = anchor.web3.Keypair.generate();
    const checkedInAttendee = anchor.web3.Keypair.generate();
    const reservedAttendee = anchor.web3.Keypair.generate();
    const waitlistedAttendee = anchor.web3.Keypair.generate();

    const { eventPda } = await initializeEvent({
      host,
      seatCount: 2,
      settlementMode: strictMode,
    });

    const checkedInReservation = await reserveSeat(eventPda, checkedInAttendee);
    const reservedReservation = await reserveSeat(eventPda, reservedAttendee);
    const waitlistedReservation = await reserveSeat(eventPda, waitlistedAttendee);
    const fundingConfig = getFundingConfig(eventPda);
    const checkedInAttendeeAta = getAttendeeDepositAta(eventPda, checkedInAttendee.publicKey);
    const reservedAttendeeAta = getAttendeeDepositAta(eventPda, reservedAttendee.publicKey);
    const waitlistedAttendeeAta = getAttendeeDepositAta(eventPda, waitlistedAttendee.publicKey);

    const checkInTransaction = await program.methods
      .checkIn()
      .accountsPartial({
        host: host.publicKey,
        event: eventPda,
        reservation: checkedInReservation,
      })
      .transaction();
    await sendTransaction(checkInTransaction, host);

    await cancelEvent({
      host,
      eventPda,
    });

    const checkedInBalanceBeforeSettlement = await getTokenBalance(checkedInAttendeeAta);
    const reservedBalanceBeforeSettlement = await getTokenBalance(reservedAttendeeAta);
    const waitlistedBalanceBeforeSettlement = await getTokenBalance(waitlistedAttendeeAta);
    const vaultBalanceBeforeSettlement = await getTokenBalance(fundingConfig.eventVaultAta);

    await settleReservation({
      host,
      eventPda,
      reservationPda: checkedInReservation,
    });
    await settleReservation({
      host,
      eventPda,
      reservationPda: reservedReservation,
    });
    await settleReservation({
      host,
      eventPda,
      reservationPda: waitlistedReservation,
    });

    const event = await program.account.eventAccount.fetch(eventPda);
    const checkedInReservationAccount = await program.account.reservationAccount.fetch(
      checkedInReservation
    );
    const reservedReservationAccount = await program.account.reservationAccount.fetch(
      reservedReservation
    );
    const waitlistedReservationAccount = await program.account.reservationAccount.fetch(
      waitlistedReservation
    );
    const checkedInBalanceAfterSettlement = await getTokenBalance(checkedInAttendeeAta);
    const reservedBalanceAfterSettlement = await getTokenBalance(reservedAttendeeAta);
    const waitlistedBalanceAfterSettlement = await getTokenBalance(waitlistedAttendeeAta);
    const vaultBalanceAfterSettlement = await getTokenBalance(fundingConfig.eventVaultAta);

    expect(enumVariant(event.status as Record<string, unknown>)).to.equal("cancelled");
    expect(enumVariant(checkedInReservationAccount.status as Record<string, unknown>)).to.equal(
      "refunded"
    );
    expect(enumVariant(reservedReservationAccount.status as Record<string, unknown>)).to.equal(
      "refunded"
    );
    expect(enumVariant(waitlistedReservationAccount.status as Record<string, unknown>)).to.equal(
      "refunded"
    );
    expect(checkedInBalanceAfterSettlement - checkedInBalanceBeforeSettlement).to.equal(
      500_000_000n
    );
    expect(reservedBalanceAfterSettlement - reservedBalanceBeforeSettlement).to.equal(
      500_000_000n
    );
    expect(waitlistedBalanceAfterSettlement - waitlistedBalanceBeforeSettlement).to.equal(
      500_000_000n
    );
    expect(vaultBalanceBeforeSettlement - vaultBalanceAfterSettlement).to.equal(1_500_000_000n);
    expect(vaultBalanceAfterSettlement).to.equal(0n);
  });

  it("refunds reserved reservations in party mode after event cancellation", async () => {
    const host = anchor.web3.Keypair.generate();
    const attendee = anchor.web3.Keypair.generate();

    const { eventPda } = await initializeEvent({
      host,
      seatCount: 1,
      settlementMode: partyMode,
    });

    const reservation = await reserveSeat(eventPda, attendee);
    const fundingConfig = getFundingConfig(eventPda);
    const attendeeAta = getAttendeeDepositAta(eventPda, attendee.publicKey);

    await cancelEvent({
      host,
      eventPda,
    });

    const attendeeBalanceBeforeSettlement = await getTokenBalance(attendeeAta);
    const vaultBalanceBeforeSettlement = await getTokenBalance(fundingConfig.eventVaultAta);

    await settleReservation({
      host,
      eventPda,
      reservationPda: reservation,
    });

    const event = await program.account.eventAccount.fetch(eventPda);
    const reservationAccount = await program.account.reservationAccount.fetch(reservation);
    const attendeeBalanceAfterSettlement = await getTokenBalance(attendeeAta);
    const vaultBalanceAfterSettlement = await getTokenBalance(fundingConfig.eventVaultAta);

    expect(enumVariant(event.status as Record<string, unknown>)).to.equal("cancelled");
    expect(enumVariant(reservationAccount.status as Record<string, unknown>)).to.equal(
      "refunded"
    );
    expect(attendeeBalanceAfterSettlement - attendeeBalanceBeforeSettlement).to.equal(
      500_000_000n
    );
    expect(vaultBalanceBeforeSettlement - vaultBalanceAfterSettlement).to.equal(500_000_000n);
    expect(vaultBalanceAfterSettlement).to.equal(0n);
  });

  it("settles checked-in and no-show reservations in strict mode", async () => {
    const host = anchor.web3.Keypair.generate();
    const attendeeOne = anchor.web3.Keypair.generate();
    const attendeeTwo = anchor.web3.Keypair.generate();

    const { eventPda } = await initializeEvent({
      host,
      seatCount: 2,
      settlementMode: strictMode,
      startTimeValue: 1_700_000_000,
    });

    const firstReservation = await reserveSeat(eventPda, attendeeOne);
    const secondReservation = await reserveSeat(eventPda, attendeeTwo);
    const fundingConfig = getFundingConfig(eventPda);
    const hostDepositAta = await createAta(
      host,
      fundingConfig.depositMint,
      host.publicKey
    );
    const attendeeOneDepositAta = getAttendeeDepositAta(eventPda, attendeeOne.publicKey);
    const attendeeTwoDepositAta = getAttendeeDepositAta(eventPda, attendeeTwo.publicKey);

    const checkInTransaction = await program.methods
      .checkIn()
        .accountsPartial({
          host: host.publicKey,
          event: eventPda,
          reservation: firstReservation,
        })
      .transaction();
    await sendTransaction(checkInTransaction, host);

    const attendeeOneBalanceBeforeSettlement = await getTokenBalance(attendeeOneDepositAta);
    const attendeeTwoBalanceBeforeSettlement = await getTokenBalance(attendeeTwoDepositAta);
    const hostBalanceBeforeSettlement = await getTokenBalance(hostDepositAta);
    const vaultBalanceBeforeSettlement = await getTokenBalance(fundingConfig.eventVaultAta);

    await settleReservation({
      host,
      eventPda,
      reservationPda: firstReservation,
    });

    await settleReservation({
      host,
      eventPda,
      reservationPda: secondReservation,
    });

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
    const attendeeOneBalanceAfterSettlement = await getTokenBalance(attendeeOneDepositAta);
    const attendeeTwoBalanceAfterSettlement = await getTokenBalance(attendeeTwoDepositAta);
    const hostBalanceAfterSettlement = await getTokenBalance(hostDepositAta);
    const vaultBalanceAfterSettlement = await getTokenBalance(fundingConfig.eventVaultAta);

    expect(event.checkedInCount).to.equal(1);
    expect(enumVariant(event.status as Record<string, unknown>)).to.equal("settled");
    expect(enumVariant(reservationOne.status as Record<string, unknown>)).to.equal(
      "refunded"
    );
    expect(enumVariant(reservationTwo.status as Record<string, unknown>)).to.equal(
      "forfeited"
    );
    expect(attendeeOneBalanceAfterSettlement - attendeeOneBalanceBeforeSettlement).to.equal(
      500_000_000n
    );
    expect(attendeeTwoBalanceAfterSettlement).to.equal(attendeeTwoBalanceBeforeSettlement);
    expect(hostBalanceAfterSettlement - hostBalanceBeforeSettlement).to.equal(500_000_000n);
    expect(vaultBalanceBeforeSettlement - vaultBalanceAfterSettlement).to.equal(1_000_000_000n);
  });

  it("marks no-shows without forfeiture in party mode", async () => {
    const host = anchor.web3.Keypair.generate();
    const attendee = anchor.web3.Keypair.generate();

    const { eventPda } = await initializeEvent({
      host,
      seatCount: 1,
      settlementMode: partyMode,
      startTimeValue: 1_700_000_000,
    });
    const reservation = await reserveSeat(eventPda, attendee);

    const settleTransaction = await buildSettleReservationTransaction({
      host,
      eventPda,
      reservationPda: reservation,
    });
    await sendTransaction(settleTransaction, host);

    const settledReservation = await program.account.reservationAccount.fetch(
      reservation
    );
    expect(enumVariant(settledReservation.status as Record<string, unknown>)).to.equal(
      "noShow"
    );
  });

  it("does not allow preparing party distribution before all reservations are settled", async () => {
    const host = anchor.web3.Keypair.generate();
    const attendeeOne = anchor.web3.Keypair.generate();
    const attendeeTwo = anchor.web3.Keypair.generate();

    const { eventPda } = await initializeEvent({
      host,
      seatCount: 2,
      settlementMode: partyMode,
      startTimeValue: 1_700_000_000,
    });

    const checkedInReservation = await reserveSeat(eventPda, attendeeOne);
    await reserveSeat(eventPda, attendeeTwo);

    const checkInTransaction = await program.methods
      .checkIn()
      .accountsPartial({
        host: host.publicKey,
        event: eventPda,
        reservation: checkedInReservation,
      })
      .transaction();
    await sendTransaction(checkInTransaction, host);

    await settleReservation({
      host,
      eventPda,
      reservationPda: checkedInReservation,
    });

    const prepareTransaction = await buildPreparePartyDistributionTransaction({
      host,
      eventPda,
    });

    await expectAnchorError(
      sendTransaction(prepareTransaction, host),
      "EventNotReadyToFinalize"
    );
  });

  it("prepares party distribution and sends the remainder to the host", async () => {
    const host = anchor.web3.Keypair.generate();
    const attendeeOne = anchor.web3.Keypair.generate();
    const attendeeTwo = anchor.web3.Keypair.generate();
    const attendeeThree = anchor.web3.Keypair.generate();

    const { eventPda } = await initializeEvent({
      host,
      seatCount: 3,
      settlementMode: partyMode,
      startTimeValue: 1_700_000_000,
    });

    const checkedInOneReservation = await reserveSeat(eventPda, attendeeOne);
    const checkedInTwoReservation = await reserveSeat(eventPda, attendeeTwo);
    const noShowReservation = await reserveSeat(eventPda, attendeeThree);
    const fundingConfig = getFundingConfig(eventPda);
    const hostDepositAta = await createAta(host, fundingConfig.depositMint, host.publicKey);

    for (const reservationPda of [checkedInOneReservation, checkedInTwoReservation]) {
      const checkInTransaction = await program.methods
        .checkIn()
        .accountsPartial({
          host: host.publicKey,
          event: eventPda,
          reservation: reservationPda,
        })
        .transaction();
      await sendTransaction(checkInTransaction, host);
    }

    await settleReservation({ host, eventPda, reservationPda: checkedInOneReservation });
    await settleReservation({ host, eventPda, reservationPda: checkedInTwoReservation });
    await settleReservation({ host, eventPda, reservationPda: noShowReservation });

    const hostBalanceBeforePrepare = await getTokenBalance(hostDepositAta);
    const vaultBalanceBeforePrepare = await getTokenBalance(fundingConfig.eventVaultAta);

    const prepareTransaction = await buildPreparePartyDistributionTransaction({
      host,
      eventPda,
    });
    await sendTransaction(prepareTransaction, host);

    const event = await program.account.eventAccount.fetch(eventPda);
    const hostBalanceAfterPrepare = await getTokenBalance(hostDepositAta);
    const vaultBalanceAfterPrepare = await getTokenBalance(fundingConfig.eventVaultAta);

    expect(event.partyBonusPrepared).to.equal(true);
    expect(event.partyBonusPerAttendee.toString()).to.equal("250000000");
    expect(event.partyBonusClaimedCount).to.equal(0);
    expect(hostBalanceAfterPrepare - hostBalanceBeforePrepare).to.equal(0n);
    expect(vaultBalanceBeforePrepare).to.equal(500_000_000n);
    expect(vaultBalanceAfterPrepare).to.equal(500_000_000n);
  });

  it("sends the full no-show pool to the host when nobody checked in", async () => {
    const host = anchor.web3.Keypair.generate();
    const attendee = anchor.web3.Keypair.generate();

    const { eventPda } = await initializeEvent({
      host,
      seatCount: 1,
      settlementMode: partyMode,
      startTimeValue: 1_700_000_000,
    });

    const reservation = await reserveSeat(eventPda, attendee);
    const fundingConfig = getFundingConfig(eventPda);
    const hostDepositAta = await createAta(host, fundingConfig.depositMint, host.publicKey);

    await settleReservation({ host, eventPda, reservationPda: reservation });

    const hostBalanceBeforePrepare = await getTokenBalance(hostDepositAta);

    const prepareTransaction = await buildPreparePartyDistributionTransaction({
      host,
      eventPda,
    });
    await sendTransaction(prepareTransaction, host);

    const event = await program.account.eventAccount.fetch(eventPda);
    const hostBalanceAfterPrepare = await getTokenBalance(hostDepositAta);
    const vaultBalanceAfterPrepare = await getTokenBalance(fundingConfig.eventVaultAta);

    expect(event.partyBonusPrepared).to.equal(true);
    expect(event.partyBonusPerAttendee.toString()).to.equal("0");
    expect(hostBalanceAfterPrepare - hostBalanceBeforePrepare).to.equal(500_000_000n);
    expect(vaultBalanceAfterPrepare).to.equal(0n);
  });

  it("allows checked-in attendees to claim an equal party bonus", async () => {
    const host = anchor.web3.Keypair.generate();
    const attendeeOne = anchor.web3.Keypair.generate();
    const attendeeTwo = anchor.web3.Keypair.generate();
    const attendeeThree = anchor.web3.Keypair.generate();

    const { eventPda } = await initializeEvent({
      host,
      seatCount: 3,
      settlementMode: partyMode,
      startTimeValue: 1_700_000_000,
    });

    const checkedInOneReservation = await reserveSeat(eventPda, attendeeOne);
    const checkedInTwoReservation = await reserveSeat(eventPda, attendeeTwo);
    const noShowReservation = await reserveSeat(eventPda, attendeeThree);
    const fundingConfig = getFundingConfig(eventPda);

    for (const reservationPda of [checkedInOneReservation, checkedInTwoReservation]) {
      const checkInTransaction = await program.methods
        .checkIn()
        .accountsPartial({
          host: host.publicKey,
          event: eventPda,
          reservation: reservationPda,
        })
        .transaction();
      await sendTransaction(checkInTransaction, host);
    }

    await settleReservation({ host, eventPda, reservationPda: checkedInOneReservation });
    await settleReservation({ host, eventPda, reservationPda: checkedInTwoReservation });
    await settleReservation({ host, eventPda, reservationPda: noShowReservation });

    const prepareTransaction = await buildPreparePartyDistributionTransaction({
      host,
      eventPda,
    });
    await sendTransaction(prepareTransaction, host);

    const attendeeOneAta = getAttendeeDepositAta(eventPda, attendeeOne.publicKey);
    const attendeeTwoAta = getAttendeeDepositAta(eventPda, attendeeTwo.publicKey);
    const attendeeOneBalanceBeforeClaim = await getTokenBalance(attendeeOneAta);
    const attendeeTwoBalanceBeforeClaim = await getTokenBalance(attendeeTwoAta);

    await claimPartyBonus({ attendee: attendeeOne, eventPda, reservationPda: checkedInOneReservation });
    await claimPartyBonus({ attendee: attendeeTwo, eventPda, reservationPda: checkedInTwoReservation });

    const event = await program.account.eventAccount.fetch(eventPda);
    const attendeeOneReservation = await program.account.reservationAccount.fetch(checkedInOneReservation);
    const attendeeTwoReservation = await program.account.reservationAccount.fetch(checkedInTwoReservation);
    const attendeeOneBalanceAfterClaim = await getTokenBalance(attendeeOneAta);
    const attendeeTwoBalanceAfterClaim = await getTokenBalance(attendeeTwoAta);
    const vaultBalanceAfterClaim = await getTokenBalance(fundingConfig.eventVaultAta);

    expect(event.partyBonusClaimedCount).to.equal(2);
    expect(attendeeOneReservation.partyBonusClaimed).to.equal(true);
    expect(attendeeTwoReservation.partyBonusClaimed).to.equal(true);
    expect(attendeeOneBalanceAfterClaim - attendeeOneBalanceBeforeClaim).to.equal(250_000_000n);
    expect(attendeeTwoBalanceAfterClaim - attendeeTwoBalanceBeforeClaim).to.equal(250_000_000n);
    expect(vaultBalanceAfterClaim).to.equal(0n);
  });

  it("does not allow claiming a party bonus twice", async () => {
    const host = anchor.web3.Keypair.generate();
    const attendee = anchor.web3.Keypair.generate();
    const noShow = anchor.web3.Keypair.generate();

    const { eventPda } = await initializeEvent({
      host,
      seatCount: 2,
      settlementMode: partyMode,
      startTimeValue: 1_700_000_000,
    });

    const checkedInReservation = await reserveSeat(eventPda, attendee);
    const noShowReservation = await reserveSeat(eventPda, noShow);

    const checkInTransaction = await program.methods
      .checkIn()
      .accountsPartial({
        host: host.publicKey,
        event: eventPda,
        reservation: checkedInReservation,
      })
      .transaction();
    await sendTransaction(checkInTransaction, host);

    await settleReservation({ host, eventPda, reservationPda: checkedInReservation });
    await settleReservation({ host, eventPda, reservationPda: noShowReservation });

    const prepareTransaction = await buildPreparePartyDistributionTransaction({
      host,
      eventPda,
    });
    await sendTransaction(prepareTransaction, host);

    await claimPartyBonus({ attendee, eventPda, reservationPda: checkedInReservation });

    const secondClaimTransaction = await buildClaimPartyBonusTransaction({
      attendee,
      eventPda,
      reservationPda: checkedInReservation,
    });

    await expectAnchorError(
      sendTransaction(secondClaimTransaction, attendee),
      "PartyBonusAlreadyClaimed"
    );
  });

  it("does not allow no-shows to claim a party bonus", async () => {
    const host = anchor.web3.Keypair.generate();
    const checkedIn = anchor.web3.Keypair.generate();
    const noShow = anchor.web3.Keypair.generate();

    const { eventPda } = await initializeEvent({
      host,
      seatCount: 2,
      settlementMode: partyMode,
      startTimeValue: 1_700_000_000,
    });

    const checkedInReservation = await reserveSeat(eventPda, checkedIn);
    const noShowReservation = await reserveSeat(eventPda, noShow);

    const checkInTransaction = await program.methods
      .checkIn()
      .accountsPartial({
        host: host.publicKey,
        event: eventPda,
        reservation: checkedInReservation,
      })
      .transaction();
    await sendTransaction(checkInTransaction, host);

    await settleReservation({ host, eventPda, reservationPda: checkedInReservation });
    await settleReservation({ host, eventPda, reservationPda: noShowReservation });

    const prepareTransaction = await buildPreparePartyDistributionTransaction({
      host,
      eventPda,
    });
    await sendTransaction(prepareTransaction, host);

    const claimTransaction = await buildClaimPartyBonusTransaction({
      attendee: noShow,
      eventPda,
      reservationPda: noShowReservation,
    });

    await expectAnchorError(
      sendTransaction(claimTransaction, noShow),
      "PartyBonusIneligible"
    );
  });

  it("does not finalize a party event before distribution is prepared", async () => {
    const host = anchor.web3.Keypair.generate();
    const checkedIn = anchor.web3.Keypair.generate();
    const noShow = anchor.web3.Keypair.generate();

    const { eventPda } = await initializeEvent({
      host,
      seatCount: 2,
      settlementMode: partyMode,
      startTimeValue: 1_700_000_000,
    });

    const checkedInReservation = await reserveSeat(eventPda, checkedIn);
    const noShowReservation = await reserveSeat(eventPda, noShow);

    const checkInTransaction = await program.methods
      .checkIn()
      .accountsPartial({
        host: host.publicKey,
        event: eventPda,
        reservation: checkedInReservation,
      })
      .transaction();
    await sendTransaction(checkInTransaction, host);

    await settleReservation({ host, eventPda, reservationPda: checkedInReservation });
    await settleReservation({ host, eventPda, reservationPda: noShowReservation });

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

  it("does not finalize a party event before all eligible attendees claim", async () => {
    const host = anchor.web3.Keypair.generate();
    const checkedInOne = anchor.web3.Keypair.generate();
    const checkedInTwo = anchor.web3.Keypair.generate();
    const noShow = anchor.web3.Keypair.generate();

    const { eventPda } = await initializeEvent({
      host,
      seatCount: 3,
      settlementMode: partyMode,
      startTimeValue: 1_700_000_000,
    });

    const checkedInOneReservation = await reserveSeat(eventPda, checkedInOne);
    const checkedInTwoReservation = await reserveSeat(eventPda, checkedInTwo);
    const noShowReservation = await reserveSeat(eventPda, noShow);

    for (const reservationPda of [checkedInOneReservation, checkedInTwoReservation]) {
      const checkInTransaction = await program.methods
        .checkIn()
        .accountsPartial({
          host: host.publicKey,
          event: eventPda,
          reservation: reservationPda,
        })
        .transaction();
      await sendTransaction(checkInTransaction, host);
    }

    await settleReservation({ host, eventPda, reservationPda: checkedInOneReservation });
    await settleReservation({ host, eventPda, reservationPda: checkedInTwoReservation });
    await settleReservation({ host, eventPda, reservationPda: noShowReservation });

    const prepareTransaction = await buildPreparePartyDistributionTransaction({
      host,
      eventPda,
    });
    await sendTransaction(prepareTransaction, host);

    await claimPartyBonus({ attendee: checkedInOne, eventPda, reservationPda: checkedInOneReservation });

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

  it("finalizes a party event after all eligible attendees claim", async () => {
    const host = anchor.web3.Keypair.generate();
    const checkedInOne = anchor.web3.Keypair.generate();
    const checkedInTwo = anchor.web3.Keypair.generate();
    const noShow = anchor.web3.Keypair.generate();

    const { eventPda } = await initializeEvent({
      host,
      seatCount: 3,
      settlementMode: partyMode,
      startTimeValue: 1_700_000_000,
    });

    const checkedInOneReservation = await reserveSeat(eventPda, checkedInOne);
    const checkedInTwoReservation = await reserveSeat(eventPda, checkedInTwo);
    const noShowReservation = await reserveSeat(eventPda, noShow);
    const fundingConfig = getFundingConfig(eventPda);

    for (const reservationPda of [checkedInOneReservation, checkedInTwoReservation]) {
      const checkInTransaction = await program.methods
        .checkIn()
        .accountsPartial({
          host: host.publicKey,
          event: eventPda,
          reservation: reservationPda,
        })
        .transaction();
      await sendTransaction(checkInTransaction, host);
    }

    await settleReservation({ host, eventPda, reservationPda: checkedInOneReservation });
    await settleReservation({ host, eventPda, reservationPda: checkedInTwoReservation });
    await settleReservation({ host, eventPda, reservationPda: noShowReservation });

    const prepareTransaction = await buildPreparePartyDistributionTransaction({
      host,
      eventPda,
    });
    await sendTransaction(prepareTransaction, host);

    await claimPartyBonus({ attendee: checkedInOne, eventPda, reservationPda: checkedInOneReservation });
    await claimPartyBonus({ attendee: checkedInTwo, eventPda, reservationPda: checkedInTwoReservation });

    const finalizeTransaction = await program.methods
      .finalizeEvent()
      .accountsPartial({
        host: host.publicKey,
        event: eventPda,
      })
      .transaction();
    await sendTransaction(finalizeTransaction, host);

    const event = await program.account.eventAccount.fetch(eventPda);
    const vaultBalanceAfterFinalize = await getTokenBalance(fundingConfig.eventVaultAta);

    expect(enumVariant(event.status as Record<string, unknown>)).to.equal("settled");
    expect(event.partyBonusPrepared).to.equal(true);
    expect(event.partyBonusClaimedCount).to.equal(2);
    expect(vaultBalanceAfterFinalize).to.equal(0n);
  });

  it("funds a sponsor pool into the sponsor vault", async () => {
    const host = anchor.web3.Keypair.generate();
    const sponsor = anchor.web3.Keypair.generate();

    const { eventPda } = await initializeEvent({
      host,
      seatCount: 2,
      settlementMode: sponsorMode,
      startTimeValue: 1_700_000_000,
    });

    const sponsorConfig = await setupSponsorFunding({
      sponsor,
      eventPda,
      amount: 900_000_000n,
    });

    const sponsorBalanceBeforeFunding = await getTokenBalance(
      sponsorConfig.sponsorSourceAta
    );

    await fundSponsorPool({
      sponsor,
      eventPda,
      amount: 900_000_000n,
    });

    const event = await program.account.eventAccount.fetch(eventPda);
    const sponsorBalanceAfterFunding = await getTokenBalance(
      sponsorConfig.sponsorSourceAta
    );
    const sponsorVaultBalance = await getTokenBalance(
      sponsorConfig.sponsorVaultAta
    );

    expect(event.sponsor?.toBase58()).to.equal(sponsor.publicKey.toBase58());
    expect(sponsorBalanceBeforeFunding - sponsorBalanceAfterFunding).to.equal(900_000_000n);
    expect(sponsorVaultBalance).to.equal(900_000_000n);
  });

  it("does not allow funding a sponsor pool for a non-sponsor event", async () => {
    const host = anchor.web3.Keypair.generate();
    const sponsor = anchor.web3.Keypair.generate();

    const { eventPda } = await initializeEvent({
      host,
      seatCount: 2,
      settlementMode: strictMode,
      startTimeValue: 1_700_000_000,
    });

    await setupSponsorFunding({
      sponsor,
      eventPda,
      amount: 500_000_000n,
    });

    const fundTransaction = await buildFundSponsorPoolTransaction({
      sponsor,
      eventPda,
      amount: 500_000_000n,
    });

    await expectAnchorError(
      sendTransaction(fundTransaction, sponsor),
      "SponsorDistributionUnavailable"
    );
  });

  it("does not allow switching sponsors for the same event", async () => {
    const host = anchor.web3.Keypair.generate();
    const firstSponsor = anchor.web3.Keypair.generate();
    const secondSponsor = anchor.web3.Keypair.generate();

    const { eventPda } = await initializeEvent({
      host,
      seatCount: 2,
      settlementMode: sponsorMode,
      startTimeValue: 1_700_000_000,
    });

    await setupSponsorFunding({
      sponsor: firstSponsor,
      eventPda,
      amount: 500_000_000n,
    });
    await fundSponsorPool({
      sponsor: firstSponsor,
      eventPda,
      amount: 500_000_000n,
    });

    await setupSponsorFunding({
      sponsor: secondSponsor,
      eventPda,
      amount: 500_000_000n,
    });

    const secondFundTransaction = await buildFundSponsorPoolTransaction({
      sponsor: secondSponsor,
      eventPda,
      amount: 500_000_000n,
    });

    await expectAnchorError(
      sendTransaction(secondFundTransaction, secondSponsor),
      "SponsorMismatch"
    );
  });

  it("refunds the sponsor pool to the sponsor after sponsor event cancellation", async () => {
    const host = anchor.web3.Keypair.generate();
    const sponsor = anchor.web3.Keypair.generate();
    const attendee = anchor.web3.Keypair.generate();

    const { eventPda } = await initializeEvent({
      host,
      seatCount: 1,
      settlementMode: sponsorMode,
      startTimeValue: 1_700_000_000,
    });

    const reservationPda = await reserveSeat(eventPda, attendee);
    const fundingConfig = getFundingConfig(eventPda);
    const attendeeAta = getAttendeeDepositAta(eventPda, attendee.publicKey);
    const sponsorConfig = await setupSponsorFunding({
      sponsor,
      eventPda,
      amount: 700_000_000n,
    });

    await fundSponsorPool({
      sponsor,
      eventPda,
      amount: 700_000_000n,
    });

    await cancelEvent({
      host,
      eventPda,
    });

    const attendeeBalanceBeforeSettlement = await getTokenBalance(attendeeAta);
    const sponsorBalanceBeforeRefund = await getTokenBalance(sponsorConfig.sponsorSourceAta);
    const sponsorVaultBeforeRefund = await getTokenBalance(sponsorConfig.sponsorVaultAta);

    await settleReservation({
      host,
      eventPda,
      reservationPda,
    });
    await refundCancelledSponsorPool({
      sponsor,
      eventPda,
    });

    const event = await program.account.eventAccount.fetch(eventPda);
    const reservationAccount = await program.account.reservationAccount.fetch(reservationPda);
    const attendeeBalanceAfterSettlement = await getTokenBalance(attendeeAta);
    const sponsorBalanceAfterRefund = await getTokenBalance(sponsorConfig.sponsorSourceAta);
    const sponsorVaultAfterRefund = await getTokenBalance(sponsorConfig.sponsorVaultAta);
    const eventVaultBalance = await getTokenBalance(fundingConfig.eventVaultAta);

    expect(enumVariant(event.status as Record<string, unknown>)).to.equal("cancelled");
    expect(enumVariant(reservationAccount.status as Record<string, unknown>)).to.equal(
      "refunded"
    );
    expect(attendeeBalanceAfterSettlement - attendeeBalanceBeforeSettlement).to.equal(
      500_000_000n
    );
    expect(sponsorBalanceAfterRefund - sponsorBalanceBeforeRefund).to.equal(700_000_000n);
    expect(sponsorVaultBeforeRefund - sponsorVaultAfterRefund).to.equal(700_000_000n);
    expect(sponsorVaultAfterRefund).to.equal(0n);
    expect(eventVaultBalance).to.equal(0n);
  });

  it("settles sponsor mode deposits and leaves sponsor pool separate", async () => {
    const host = anchor.web3.Keypair.generate();
    const sponsor = anchor.web3.Keypair.generate();
    const attendeeOne = anchor.web3.Keypair.generate();
    const attendeeTwo = anchor.web3.Keypair.generate();

    const { eventPda } = await initializeEvent({
      host,
      seatCount: 2,
      settlementMode: sponsorMode,
      startTimeValue: 1_700_000_000,
    });

    const checkedInReservation = await reserveSeat(eventPda, attendeeOne);
    const noShowReservation = await reserveSeat(eventPda, attendeeTwo);
    const fundingConfig = getFundingConfig(eventPda);
    await setupSponsorFunding({ sponsor, eventPda, amount: 800_000_000n });
    await fundSponsorPool({ sponsor, eventPda, amount: 800_000_000n });

    const hostDepositAta = await createAta(host, fundingConfig.depositMint, host.publicKey);
    const checkedInAta = getAttendeeDepositAta(eventPda, attendeeOne.publicKey);
    const sponsorConfig = getSponsorFundingConfig(eventPda);

    const checkInTransaction = await program.methods
      .checkIn()
      .accountsPartial({
        host: host.publicKey,
        event: eventPda,
        reservation: checkedInReservation,
      })
      .transaction();
    await sendTransaction(checkInTransaction, host);

    const hostBalanceBeforeSettlement = await getTokenBalance(hostDepositAta);
    const attendeeBalanceBeforeSettlement = await getTokenBalance(checkedInAta);
    const sponsorVaultBeforeSettlement = await getTokenBalance(sponsorConfig.sponsorVaultAta);

    await settleReservation({ host, eventPda, reservationPda: checkedInReservation });
    await settleReservation({ host, eventPda, reservationPda: noShowReservation });

    const checkedInAccount = await program.account.reservationAccount.fetch(checkedInReservation);
    const noShowAccount = await program.account.reservationAccount.fetch(noShowReservation);
    const hostBalanceAfterSettlement = await getTokenBalance(hostDepositAta);
    const attendeeBalanceAfterSettlement = await getTokenBalance(checkedInAta);
    const sponsorVaultAfterSettlement = await getTokenBalance(sponsorConfig.sponsorVaultAta);

    expect(enumVariant(checkedInAccount.status as Record<string, unknown>)).to.equal("refunded");
    expect(enumVariant(noShowAccount.status as Record<string, unknown>)).to.equal("forfeited");
    expect(hostBalanceAfterSettlement - hostBalanceBeforeSettlement).to.equal(500_000_000n);
    expect(attendeeBalanceAfterSettlement - attendeeBalanceBeforeSettlement).to.equal(
      500_000_000n
    );
    expect(sponsorVaultAfterSettlement).to.equal(sponsorVaultBeforeSettlement);
  });

  it("does not allow preparing sponsor distribution before all reservations are settled", async () => {
    const host = anchor.web3.Keypair.generate();
    const sponsor = anchor.web3.Keypair.generate();
    const attendeeOne = anchor.web3.Keypair.generate();
    const attendeeTwo = anchor.web3.Keypair.generate();

    const { eventPda } = await initializeEvent({
      host,
      seatCount: 2,
      settlementMode: sponsorMode,
      startTimeValue: 1_700_000_000,
    });

    const checkedInReservation = await reserveSeat(eventPda, attendeeOne);
    await reserveSeat(eventPda, attendeeTwo);

    await setupSponsorFunding({ sponsor, eventPda, amount: 800_000_000n });
    await fundSponsorPool({ sponsor, eventPda, amount: 800_000_000n });

    const checkInTransaction = await program.methods
      .checkIn()
      .accountsPartial({
        host: host.publicKey,
        event: eventPda,
        reservation: checkedInReservation,
      })
      .transaction();
    await sendTransaction(checkInTransaction, host);

    await settleReservation({ host, eventPda, reservationPda: checkedInReservation });

    const prepareTransaction = await buildPrepareSponsorDistributionTransaction({
      host,
      eventPda,
      sponsor,
    });

    await expectAnchorError(
      sendTransaction(prepareTransaction, host),
      "EventNotReadyToFinalize"
    );
  });

  it("prepares sponsor distribution and returns the remainder to the sponsor", async () => {
    const host = anchor.web3.Keypair.generate();
    const sponsor = anchor.web3.Keypair.generate();
    const attendeeOne = anchor.web3.Keypair.generate();
    const attendeeTwo = anchor.web3.Keypair.generate();
    const attendeeThree = anchor.web3.Keypair.generate();

    const { eventPda } = await initializeEvent({
      host,
      seatCount: 3,
      settlementMode: sponsorMode,
      startTimeValue: 1_700_000_000,
    });

    const checkedInOneReservation = await reserveSeat(eventPda, attendeeOne);
    const checkedInTwoReservation = await reserveSeat(eventPda, attendeeTwo);
    const noShowReservation = await reserveSeat(eventPda, attendeeThree);

    await setupSponsorFunding({ sponsor, eventPda, amount: 1_001_000_000n });
    await fundSponsorPool({ sponsor, eventPda, amount: 1_001_000_000n });

    for (const reservationPda of [checkedInOneReservation, checkedInTwoReservation]) {
      const checkInTransaction = await program.methods
        .checkIn()
        .accountsPartial({
          host: host.publicKey,
          event: eventPda,
          reservation: reservationPda,
        })
        .transaction();
      await sendTransaction(checkInTransaction, host);
    }

    await settleReservation({ host, eventPda, reservationPda: checkedInOneReservation });
    await settleReservation({ host, eventPda, reservationPda: checkedInTwoReservation });
    await settleReservation({ host, eventPda, reservationPda: noShowReservation });

    const sponsorConfig = getSponsorFundingConfig(eventPda);
    const sponsorBalanceBeforePrepare = await getTokenBalance(sponsorConfig.sponsorSourceAta);

    const prepareTransaction = await buildPrepareSponsorDistributionTransaction({
      host,
      eventPda,
      sponsor,
    });
    await sendTransaction(prepareTransaction, host);

    const event = await program.account.eventAccount.fetch(eventPda);
    const sponsorBalanceAfterPrepare = await getTokenBalance(sponsorConfig.sponsorSourceAta);
    const sponsorVaultAfterPrepare = await getTokenBalance(sponsorConfig.sponsorVaultAta);

    expect(event.sponsorDistributionPrepared).to.equal(true);
    expect(event.sponsorBonusPerAttendee.toString()).to.equal("500500000");
    expect(event.sponsorBonusClaimedCount).to.equal(0);
    expect(sponsorBalanceAfterPrepare - sponsorBalanceBeforePrepare).to.equal(0n);
    expect(sponsorVaultAfterPrepare).to.equal(1_001_000_000n);
  });

  it("returns the full sponsor pool when nobody checked in", async () => {
    const host = anchor.web3.Keypair.generate();
    const sponsor = anchor.web3.Keypair.generate();
    const attendee = anchor.web3.Keypair.generate();

    const { eventPda } = await initializeEvent({
      host,
      seatCount: 1,
      settlementMode: sponsorMode,
      startTimeValue: 1_700_000_000,
    });

    const reservation = await reserveSeat(eventPda, attendee);
    await setupSponsorFunding({ sponsor, eventPda, amount: 700_000_000n });
    await fundSponsorPool({ sponsor, eventPda, amount: 700_000_000n });

    await settleReservation({ host, eventPda, reservationPda: reservation });

    const sponsorConfig = getSponsorFundingConfig(eventPda);
    const sponsorBalanceBeforePrepare = await getTokenBalance(sponsorConfig.sponsorSourceAta);

    const prepareTransaction = await buildPrepareSponsorDistributionTransaction({
      host,
      eventPda,
      sponsor,
    });
    await sendTransaction(prepareTransaction, host);

    const event = await program.account.eventAccount.fetch(eventPda);
    const sponsorBalanceAfterPrepare = await getTokenBalance(sponsorConfig.sponsorSourceAta);
    const sponsorVaultAfterPrepare = await getTokenBalance(sponsorConfig.sponsorVaultAta);

    expect(event.sponsorDistributionPrepared).to.equal(true);
    expect(event.sponsorBonusPerAttendee.toString()).to.equal("0");
    expect(sponsorBalanceAfterPrepare - sponsorBalanceBeforePrepare).to.equal(700_000_000n);
    expect(sponsorVaultAfterPrepare).to.equal(0n);
  });

  it("allows checked-in attendees to claim an equal sponsor bonus", async () => {
    const host = anchor.web3.Keypair.generate();
    const sponsor = anchor.web3.Keypair.generate();
    const attendeeOne = anchor.web3.Keypair.generate();
    const attendeeTwo = anchor.web3.Keypair.generate();
    const attendeeThree = anchor.web3.Keypair.generate();

    const { eventPda } = await initializeEvent({
      host,
      seatCount: 3,
      settlementMode: sponsorMode,
      startTimeValue: 1_700_000_000,
    });

    const checkedInOneReservation = await reserveSeat(eventPda, attendeeOne);
    const checkedInTwoReservation = await reserveSeat(eventPda, attendeeTwo);
    const noShowReservation = await reserveSeat(eventPda, attendeeThree);

    await setupSponsorFunding({ sponsor, eventPda, amount: 1_000_000_000n });
    await fundSponsorPool({ sponsor, eventPda, amount: 1_000_000_000n });

    for (const reservationPda of [checkedInOneReservation, checkedInTwoReservation]) {
      const checkInTransaction = await program.methods
        .checkIn()
        .accountsPartial({
          host: host.publicKey,
          event: eventPda,
          reservation: reservationPda,
        })
        .transaction();
      await sendTransaction(checkInTransaction, host);
    }

    await settleReservation({ host, eventPda, reservationPda: checkedInOneReservation });
    await settleReservation({ host, eventPda, reservationPda: checkedInTwoReservation });
    await settleReservation({ host, eventPda, reservationPda: noShowReservation });

    const sponsorConfig = getSponsorFundingConfig(eventPda);
    const prepareTransaction = await buildPrepareSponsorDistributionTransaction({
      host,
      eventPda,
      sponsor,
    });
    await sendTransaction(prepareTransaction, host);

    const attendeeOneAta = getAttendeeDepositAta(eventPda, attendeeOne.publicKey);
    const attendeeTwoAta = getAttendeeDepositAta(eventPda, attendeeTwo.publicKey);
    const attendeeOneBalanceBeforeClaim = await getTokenBalance(attendeeOneAta);
    const attendeeTwoBalanceBeforeClaim = await getTokenBalance(attendeeTwoAta);

    await claimSponsorBonus({
      attendee: attendeeOne,
      eventPda,
      reservationPda: checkedInOneReservation,
    });
    await claimSponsorBonus({
      attendee: attendeeTwo,
      eventPda,
      reservationPda: checkedInTwoReservation,
    });

    const event = await program.account.eventAccount.fetch(eventPda);
    const firstReservation = await program.account.reservationAccount.fetch(
      checkedInOneReservation
    );
    const secondReservation = await program.account.reservationAccount.fetch(
      checkedInTwoReservation
    );
    const attendeeOneBalanceAfterClaim = await getTokenBalance(attendeeOneAta);
    const attendeeTwoBalanceAfterClaim = await getTokenBalance(attendeeTwoAta);
    const sponsorVaultAfterClaim = await getTokenBalance(sponsorConfig.sponsorVaultAta);

    expect(event.sponsorBonusClaimedCount).to.equal(2);
    expect(firstReservation.sponsorBonusClaimed).to.equal(true);
    expect(secondReservation.sponsorBonusClaimed).to.equal(true);
    expect(attendeeOneBalanceAfterClaim - attendeeOneBalanceBeforeClaim).to.equal(500_000_000n);
    expect(attendeeTwoBalanceAfterClaim - attendeeTwoBalanceBeforeClaim).to.equal(500_000_000n);
    expect(sponsorVaultAfterClaim).to.equal(0n);
  });

  it("does not allow no-shows to claim a sponsor bonus", async () => {
    const host = anchor.web3.Keypair.generate();
    const sponsor = anchor.web3.Keypair.generate();
    const checkedIn = anchor.web3.Keypair.generate();
    const noShow = anchor.web3.Keypair.generate();

    const { eventPda } = await initializeEvent({
      host,
      seatCount: 2,
      settlementMode: sponsorMode,
      startTimeValue: 1_700_000_000,
    });

    const checkedInReservation = await reserveSeat(eventPda, checkedIn);
    const noShowReservation = await reserveSeat(eventPda, noShow);

    await setupSponsorFunding({ sponsor, eventPda, amount: 600_000_000n });
    await fundSponsorPool({ sponsor, eventPda, amount: 600_000_000n });

    const checkInTransaction = await program.methods
      .checkIn()
      .accountsPartial({
        host: host.publicKey,
        event: eventPda,
        reservation: checkedInReservation,
      })
      .transaction();
    await sendTransaction(checkInTransaction, host);

    await settleReservation({ host, eventPda, reservationPda: checkedInReservation });
    await settleReservation({ host, eventPda, reservationPda: noShowReservation });

    const prepareTransaction = await buildPrepareSponsorDistributionTransaction({
      host,
      eventPda,
      sponsor,
    });
    await sendTransaction(prepareTransaction, host);

    const claimTransaction = await buildClaimSponsorBonusTransaction({
      attendee: noShow,
      eventPda,
      reservationPda: noShowReservation,
    });

    await expectAnchorError(
      sendTransaction(claimTransaction, noShow),
      "SponsorBonusIneligible"
    );
  });

  it("does not allow claiming a sponsor bonus twice", async () => {
    const host = anchor.web3.Keypair.generate();
    const sponsor = anchor.web3.Keypair.generate();
    const checkedIn = anchor.web3.Keypair.generate();
    const noShow = anchor.web3.Keypair.generate();

    const { eventPda } = await initializeEvent({
      host,
      seatCount: 2,
      settlementMode: sponsorMode,
      startTimeValue: 1_700_000_000,
    });

    const checkedInReservation = await reserveSeat(eventPda, checkedIn);
    const noShowReservation = await reserveSeat(eventPda, noShow);

    await setupSponsorFunding({ sponsor, eventPda, amount: 600_000_000n });
    await fundSponsorPool({ sponsor, eventPda, amount: 600_000_000n });

    const checkInTransaction = await program.methods
      .checkIn()
      .accountsPartial({
        host: host.publicKey,
        event: eventPda,
        reservation: checkedInReservation,
      })
      .transaction();
    await sendTransaction(checkInTransaction, host);

    await settleReservation({ host, eventPda, reservationPda: checkedInReservation });
    await settleReservation({ host, eventPda, reservationPda: noShowReservation });

    const prepareTransaction = await buildPrepareSponsorDistributionTransaction({
      host,
      eventPda,
      sponsor,
    });
    await sendTransaction(prepareTransaction, host);

    await claimSponsorBonus({ attendee: checkedIn, eventPda, reservationPda: checkedInReservation });

    const secondClaimTransaction = await buildClaimSponsorBonusTransaction({
      attendee: checkedIn,
      eventPda,
      reservationPda: checkedInReservation,
    });

    await expectAnchorError(
      sendTransaction(secondClaimTransaction, checkedIn),
      "SponsorBonusAlreadyClaimed"
    );
  });

  it("does not finalize a sponsor event before sponsor distribution is prepared", async () => {
    const host = anchor.web3.Keypair.generate();
    const sponsor = anchor.web3.Keypair.generate();
    const checkedIn = anchor.web3.Keypair.generate();
    const noShow = anchor.web3.Keypair.generate();

    const { eventPda } = await initializeEvent({
      host,
      seatCount: 2,
      settlementMode: sponsorMode,
      startTimeValue: 1_700_000_000,
    });

    const checkedInReservation = await reserveSeat(eventPda, checkedIn);
    const noShowReservation = await reserveSeat(eventPda, noShow);

    await setupSponsorFunding({ sponsor, eventPda, amount: 600_000_000n });
    await fundSponsorPool({ sponsor, eventPda, amount: 600_000_000n });

    const checkInTransaction = await program.methods
      .checkIn()
      .accountsPartial({
        host: host.publicKey,
        event: eventPda,
        reservation: checkedInReservation,
      })
      .transaction();
    await sendTransaction(checkInTransaction, host);

    await settleReservation({ host, eventPda, reservationPda: checkedInReservation });
    await settleReservation({ host, eventPda, reservationPda: noShowReservation });

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

  it("does not finalize a sponsor event before all eligible attendees claim", async () => {
    const host = anchor.web3.Keypair.generate();
    const sponsor = anchor.web3.Keypair.generate();
    const checkedInOne = anchor.web3.Keypair.generate();
    const checkedInTwo = anchor.web3.Keypair.generate();
    const noShow = anchor.web3.Keypair.generate();

    const { eventPda } = await initializeEvent({
      host,
      seatCount: 3,
      settlementMode: sponsorMode,
      startTimeValue: 1_700_000_000,
    });

    const checkedInOneReservation = await reserveSeat(eventPda, checkedInOne);
    const checkedInTwoReservation = await reserveSeat(eventPda, checkedInTwo);
    const noShowReservation = await reserveSeat(eventPda, noShow);

    await setupSponsorFunding({ sponsor, eventPda, amount: 1_000_000_000n });
    await fundSponsorPool({ sponsor, eventPda, amount: 1_000_000_000n });

    for (const reservationPda of [checkedInOneReservation, checkedInTwoReservation]) {
      const checkInTransaction = await program.methods
        .checkIn()
        .accountsPartial({
          host: host.publicKey,
          event: eventPda,
          reservation: reservationPda,
        })
        .transaction();
      await sendTransaction(checkInTransaction, host);
    }

    await settleReservation({ host, eventPda, reservationPda: checkedInOneReservation });
    await settleReservation({ host, eventPda, reservationPda: checkedInTwoReservation });
    await settleReservation({ host, eventPda, reservationPda: noShowReservation });

    const prepareTransaction = await buildPrepareSponsorDistributionTransaction({
      host,
      eventPda,
      sponsor,
    });
    await sendTransaction(prepareTransaction, host);

    await claimSponsorBonus({
      attendee: checkedInOne,
      eventPda,
      reservationPda: checkedInOneReservation,
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

  it("finalizes a sponsor event after all eligible attendees claim", async () => {
    const host = anchor.web3.Keypair.generate();
    const sponsor = anchor.web3.Keypair.generate();
    const checkedInOne = anchor.web3.Keypair.generate();
    const checkedInTwo = anchor.web3.Keypair.generate();
    const noShow = anchor.web3.Keypair.generate();

    const { eventPda } = await initializeEvent({
      host,
      seatCount: 3,
      settlementMode: sponsorMode,
      startTimeValue: 1_700_000_000,
    });

    const checkedInOneReservation = await reserveSeat(eventPda, checkedInOne);
    const checkedInTwoReservation = await reserveSeat(eventPda, checkedInTwo);
    const noShowReservation = await reserveSeat(eventPda, noShow);

    await setupSponsorFunding({ sponsor, eventPda, amount: 1_000_000_000n });
    await fundSponsorPool({ sponsor, eventPda, amount: 1_000_000_000n });

    for (const reservationPda of [checkedInOneReservation, checkedInTwoReservation]) {
      const checkInTransaction = await program.methods
        .checkIn()
        .accountsPartial({
          host: host.publicKey,
          event: eventPda,
          reservation: reservationPda,
        })
        .transaction();
      await sendTransaction(checkInTransaction, host);
    }

    await settleReservation({ host, eventPda, reservationPda: checkedInOneReservation });
    await settleReservation({ host, eventPda, reservationPda: checkedInTwoReservation });
    await settleReservation({ host, eventPda, reservationPda: noShowReservation });

    const prepareTransaction = await buildPrepareSponsorDistributionTransaction({
      host,
      eventPda,
      sponsor,
    });
    await sendTransaction(prepareTransaction, host);

    await claimSponsorBonus({
      attendee: checkedInOne,
      eventPda,
      reservationPda: checkedInOneReservation,
    });
    await claimSponsorBonus({
      attendee: checkedInTwo,
      eventPda,
      reservationPda: checkedInTwoReservation,
    });

    const finalizeTransaction = await program.methods
      .finalizeEvent()
      .accountsPartial({
        host: host.publicKey,
        event: eventPda,
      })
      .transaction();
    await sendTransaction(finalizeTransaction, host);

    const event = await program.account.eventAccount.fetch(eventPda);

    expect(enumVariant(event.status as Record<string, unknown>)).to.equal("settled");
    expect(event.sponsorDistributionPrepared).to.equal(true);
    expect(event.sponsorBonusClaimedCount).to.equal(2);
  });

  it("rejects settling a waitlisted reservation", async () => {
    const host = anchor.web3.Keypair.generate();
    const attendeeOne = anchor.web3.Keypair.generate();
    const attendeeTwo = anchor.web3.Keypair.generate();

    const { eventPda } = await initializeEvent({
      host,
      seatCount: 1,
      settlementMode: strictMode,
      startTimeValue: 1_700_000_000,
    });

    await reserveSeat(eventPda, attendeeOne);
    const waitlistedReservation = await reserveSeat(eventPda, attendeeTwo);

    const settleTransaction = await buildSettleReservationTransaction({
      host,
      eventPda,
      reservationPda: waitlistedReservation,
    });

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
      startTimeValue: 1_700_000_000,
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
      startTimeValue: 1_700_000_000,
    });

    const firstReservation = await reserveSeat(eventPda, attendeeOne);
    await reserveSeat(eventPda, attendeeTwo);

    const settleFirstTransaction = await buildSettleReservationTransaction({
      host,
      eventPda,
      reservationPda: firstReservation,
    });
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

  it("does not allow settlement before cutoff time", async () => {
    const host = anchor.web3.Keypair.generate();
    const attendee = anchor.web3.Keypair.generate();

    const { eventPda } = await initializeEvent({
      host,
      seatCount: 1,
      settlementMode: strictMode,
      startTimeValue: 4_102_444_800,
    });

    const reservation = await reserveSeat(eventPda, attendee);

    const settleTransaction = await buildSettleReservationTransaction({
      host,
      eventPda,
      reservationPda: reservation,
    });

    await expectAnchorError(
      sendTransaction(settleTransaction, host),
      "EventSettlementTooEarly"
    );
  });

  it("does not allow check-in after settlement has started", async () => {
    const host = anchor.web3.Keypair.generate();
    const attendeeOne = anchor.web3.Keypair.generate();
    const attendeeTwo = anchor.web3.Keypair.generate();

    const { eventPda } = await initializeEvent({
      host,
      seatCount: 2,
      settlementMode: strictMode,
      startTimeValue: 1_700_000_000,
    });

    const firstReservation = await reserveSeat(eventPda, attendeeOne);
    const secondReservation = await reserveSeat(eventPda, attendeeTwo);

    const settleFirstTransaction = await buildSettleReservationTransaction({
      host,
      eventPda,
      reservationPda: firstReservation,
    });
    await sendTransaction(settleFirstTransaction, host);

    const checkInTransaction = await program.methods
      .checkIn()
      .accountsPartial({
        host: host.publicKey,
        event: eventPda,
        reservation: secondReservation,
      })
      .transaction();

    await expectAnchorError(sendTransaction(checkInTransaction, host), "EventCheckInClosed");
  });

  it("prevents check-in after an event has been finalized", async () => {
    const host = anchor.web3.Keypair.generate();
    const attendeeOne = anchor.web3.Keypair.generate();
    const attendeeTwo = anchor.web3.Keypair.generate();
    const cutoffTimeValue = (await getCurrentUnixTime()) + 10;

    const { eventPda } = await initializeEvent({
      host,
      seatCount: 2,
      settlementMode: strictMode,
      cutoffTimeValue,
    });

    const firstReservation = await reserveSeat(eventPda, attendeeOne);
    const secondReservation = await reserveSeat(eventPda, attendeeTwo);

    await waitForUnixTime(cutoffTimeValue);

    const settleFirstTransaction = await buildSettleReservationTransaction({
      host,
      eventPda,
      reservationPda: firstReservation,
    });
    await sendTransaction(settleFirstTransaction, host);

    const settleSecondTransaction = await buildSettleReservationTransaction({
      host,
      eventPda,
      reservationPda: secondReservation,
    });
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
