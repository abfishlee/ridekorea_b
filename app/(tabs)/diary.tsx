import { useTranslation } from "react-i18next";
import { ScreenStub } from "../../src/components/ScreenStub";

// Diary tab — my journeys timeline & publish land in Phase 6.
export default function Diary() {
  const { t } = useTranslation();
  return <ScreenStub title={t("tabs.diary")} hint="My journeys & publish — Phase 6" />;
}
