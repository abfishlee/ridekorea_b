/**
 * Wallet: the rider's claimed vouchers + redemption.
 *
 * - fetchMyClaims: the caller's voucher claims (RLS-scoped) with voucher/region
 *   details for display.
 * - useRedeemVoucher: mark a claim used (redeem_voucher RPC). MVP is user-
 *   initiated; a v2 merchant terminal would call the same RPC.
 *
 * Completes the voucher loop: claim (geofence) → wallet → redeem.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";

export type VoucherClaimStatus = "ISSUED" | "REDEEMED" | "EXPIRED";

export interface VoucherClaim {
  id: string;
  code: string;
  status: VoucherClaimStatus;
  claimed_at: string;
  redeemed_at: string | null;
  voucher: {
    title: string;
    title_en: string | null;
    partner_name: string | null;
    discount_type: string;
    discount_value: number;
    region: { name: string; name_en: string | null } | null;
  } | null;
}

const CLAIM_SELECT =
  "id, code, status, claimed_at, redeemed_at, " +
  "voucher:vouchers!voucher_claims_voucher_id_fkey(" +
  "title, title_en, partner_name, discount_type, discount_value, " +
  "region:regions!vouchers_region_id_fkey(name, name_en))";

export async function fetchMyClaims(): Promise<VoucherClaim[]> {
  const { data, error } = await supabase
    .from("voucher_claims")
    .select(CLAIM_SELECT)
    .order("claimed_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as VoucherClaim[];
}

export function useMyClaims() {
  return useQuery({ queryKey: ["wallet"], queryFn: fetchMyClaims });
}

/** Redeem a claim; server raises NOT_REDEEMABLE if it isn't the caller's ISSUED claim. */
export function useRedeemVoucher() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (claimId: string) => {
      const { data, error } = await supabase.rpc("redeem_voucher", {
        p_claim: claimId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wallet"] }),
  });
}
