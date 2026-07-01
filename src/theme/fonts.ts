/**
 * Multilingual font loading (EN/JA/ZH/KO).
 * Latin/numbers use Inter (great tabular figures for the speedometer);
 * CJK uses the Noto family for consistent rendering.
 *
 * NOTE: loading all CJK families at startup is heavy. A later optimization is to
 * lazy-load only the active language's CJK font. For the skeleton we load all.
 * (Korean: Noto Sans KR here; can be swapped for Pretendard via local assets.)
 */
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";
import { NotoSansJP_400Regular, NotoSansJP_700Bold } from "@expo-google-fonts/noto-sans-jp";
import { NotoSansSC_400Regular, NotoSansSC_700Bold } from "@expo-google-fonts/noto-sans-sc";
import { NotoSansKR_400Regular, NotoSansKR_700Bold } from "@expo-google-fonts/noto-sans-kr";

/** Semantic font-family names; the strings match the @expo-google-fonts exports. */
export const fontFamily = {
  regular: "Inter_400Regular",
  medium: "Inter_500Medium",
  semibold: "Inter_600SemiBold",
  bold: "Inter_700Bold",
  jaRegular: "NotoSansJP_400Regular",
  jaBold: "NotoSansJP_700Bold",
  zhRegular: "NotoSansSC_400Regular",
  zhBold: "NotoSansSC_700Bold",
  koRegular: "NotoSansKR_400Regular",
  koBold: "NotoSansKR_700Bold",
} as const;

/** Loads all app fonts; returns { loaded, error } for splash gating. */
export function useAppFonts() {
  const [loaded, error] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    NotoSansJP_400Regular,
    NotoSansJP_700Bold,
    NotoSansSC_400Regular,
    NotoSansSC_700Bold,
    NotoSansKR_400Regular,
    NotoSansKR_700Bold,
  });
  return { loaded, error };
}
