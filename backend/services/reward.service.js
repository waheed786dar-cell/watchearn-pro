// ============================================
// FILE 019 — services/reward.service.js
// Credit rewards to wallet + create transaction
// ============================================

const { supabaseAdmin } = require('../config/supabase');

// ─────────────────────────────────────────
// Credit reward to user wallet
// ─────────────────────────────────────────
const creditReward = async (userId, amount, referenceId, note) => {
  try {
    // 1. Get current wallet
    const { data: wallet, error: walletErr } = await supabaseAdmin
      .from('wallets')
      .select('id, balance, total_earned')
      .eq('user_id', userId)
      .single();

    if (walletErr || !wallet) {
      // Auto-create wallet if not exists
      const { error: createErr } = await supabaseAdmin
        .from('wallets')
        .insert({
          user_id:      userId,
          balance:      amount,
          pending:      0,
          total_earned: amount,
        });
      if (createErr) throw createErr;
    } else {
      // 2. Update existing wallet
      const { error: updateErr } = await supabaseAdmin
        .from('wallets')
        .update({
          balance:      Number(wallet.balance)      + Number(amount),
          total_earned: Number(wallet.total_earned) + Number(amount),
          updated_at:   new Date().toISOString(),
        })
        .eq('user_id', userId);

      if (updateErr) throw updateErr;
    }

    // 3. Create transaction record
    const { error: txErr } = await supabaseAdmin
      .from('transactions')
      .insert({
        user_id:      userId,
        type:         'earning',
        amount:       amount,
        fee:          0,
        net_amount:   amount,
        reference_id: referenceId,
        note:         note || 'Task reward',
        status:       'completed',
      });

    if (txErr) throw txErr;

    return { success: true, credited: amount };

  } catch (err) {
    console.error('creditReward error:', err.message);
    return { success: false, error: err.message };
  }
};

// ─────────────────────────────────────────
// Deduct from wallet (for withdrawals)
// ─────────────────────────────────────────
const deductBalance = async (userId, amount, fee, referenceId, note) => {
  try {
    const netAmount = Number(amount) - Number(fee);

    const { data: wallet, error: walletErr } = await supabaseAdmin
      .from('wallets')
      .select('id, balance')
      .eq('user_id', userId)
      .single();

    if (walletErr || !wallet) throw new Error('Wallet not found');

    if (Number(wallet.balance) < Number(amount)) {
      return { success: false, error: 'Insufficient balance' };
    }

    // Deduct
    const { error: updateErr } = await supabaseAdmin
      .from('wallets')
      .update({
        balance:    Number(wallet.balance) - Number(amount),
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    if (updateErr) throw updateErr;

    // Record transaction
    const { error: txErr } = await supabaseAdmin
      .from('transactions')
      .insert({
        user_id:      userId,
        type:         'withdrawal',
        amount:       amount,
        fee:          fee,
        net_amount:   netAmount,
        reference_id: referenceId,
        note:         note || 'Withdrawal request',
        status:       'pending',
      });

    if (txErr) throw txErr;

    return { success: true, deducted: amount, net: netAmount };

  } catch (err) {
    console.error('deductBalance error:', err.message);
    return { success: false, error: err.message };
  }
};

module.exports = { creditReward, deductBalance };
