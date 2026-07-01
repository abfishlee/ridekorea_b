import { useTranslation } from "react-i18next";
import { ScreenStub } from "../../src/components/ScreenStub";

// Wallet tab — vouchers & stamp passport land in Phase 5.
export default function Wallet() {
  const { t } = useTranslation();
  return <ScreenStub title={t("tabs.wallet")} hint="Vouchers & stamps — Phase 5" />;
}
