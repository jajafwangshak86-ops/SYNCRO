import { Router, Response } from 'express';
import * as stellarSdk from '@stellar/stellar-sdk';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { supabase } from '../config/database';
import logger from '../config/logger';

type WalletVerificationMetadata = {
  verified: boolean;
  publicKey: string;
  verifiedAt: string;
};

const router = Router();

router.use(authenticate);

/**
 * POST /api/wallet/verify
 * Verify Stellar wallet ownership and persist verification status.
 */
router.post('/verify', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { publicKey, message, signature } = req.body as {
      publicKey?: string;
      message?: string;
      signature?: string;
    };

    if (!publicKey || !message || !signature) {
      return res.status(400).json({
        verified: false,
        error: 'Missing required fields: publicKey, message, and signature are required',
      });
    }

    if (!stellarSdk.StrKey.isValidEd25519PublicKey(publicKey)) {
      return res.status(400).json({
        verified: false,
        error: 'Invalid Stellar public key format',
      });
    }

    let isValid = false;
    try {
      const keypair = stellarSdk.Keypair.fromPublicKey(publicKey);
      const messageBuffer = Buffer.from(message, 'utf8');
      const signatureBuffer = Buffer.from(signature, 'base64');

      // Ed25519 signatures must be exactly 64 bytes.
      if (signatureBuffer.length !== 64) {
        return res.status(401).json({
          verified: false,
          error: 'Invalid signature - verification failed',
        });
      }

      isValid = keypair.verify(messageBuffer, signatureBuffer);
    } catch (verifyError) {
      logger.warn('Wallet signature verification failed:', verifyError);
      return res.status(401).json({
        verified: false,
        error: 'Signature verification failed',
      });
    }

    if (!isValid) {
      return res.status(401).json({
        verified: false,
        error: 'Invalid signature - verification failed',
      });
    }

    const userId = req.user!.id;
    const { data: currentUserData, error: currentUserError } = await supabase.auth.admin.getUserById(userId);

    if (currentUserError) {
      logger.error('Error loading user for wallet verification:', currentUserError);
      return res.status(500).json({
        verified: false,
        error: 'Failed to persist wallet verification',
      });
    }

    const existingMetadata =
      currentUserData.user?.user_metadata && typeof currentUserData.user.user_metadata === 'object'
        ? currentUserData.user.user_metadata
        : {};

    const walletVerification: WalletVerificationMetadata = {
      verified: true,
      publicKey,
      verifiedAt: new Date().toISOString(),
    };

    const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
      user_metadata: {
        ...existingMetadata,
        wallet_verification: walletVerification,
      },
    });

    if (updateError) {
      logger.error('Error storing wallet verification:', updateError);
      return res.status(500).json({
        verified: false,
        error: 'Failed to persist wallet verification',
      });
    }

    return res.json({
      verified: true,
      publicKey,
      message: 'Wallet successfully verified',
    });
  } catch (error) {
    logger.error('Wallet verification error:', error);
    return res.status(500).json({
      verified: false,
      error: 'Internal server error during verification',
    });
  }
});

/**
 * GET /api/wallet/status
 * Return authenticated user's wallet verification status.
 */
router.get('/status', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { data, error } = await supabase.auth.admin.getUserById(userId);

    if (error) {
      logger.error('Error fetching wallet status:', error);
      return res.status(500).json({
        verified: false,
        error: 'Failed to fetch wallet status',
      });
    }

    const metadata = data.user?.user_metadata as { wallet_verification?: WalletVerificationMetadata } | undefined;
    const walletVerification = metadata?.wallet_verification;

    if (!walletVerification?.verified || !walletVerification.publicKey) {
      return res.json({
        verified: false,
        publicKey: null,
      });
    }

    return res.json({
      verified: true,
      publicKey: walletVerification.publicKey,
      verifiedAt: walletVerification.verifiedAt,
    });
  } catch (error) {
    logger.error('Wallet status error:', error);
    return res.status(500).json({
      verified: false,
      error: 'Internal server error while fetching wallet status',
    });
  }
});

export default router;
