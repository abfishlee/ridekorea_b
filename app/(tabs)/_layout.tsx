import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import theme from "../../src/theme/theme";

export default function TabsLayout() {
  const { t } = useTranslation();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
        },
        tabBarLabelStyle: { fontFamily: theme.fontFamily.medium, fontSize: 11 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("tabs.explore"),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="compass-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="ride"
        options={{
          title: t("tabs.ride"),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="bicycle-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="diary"
        options={{
          title: t("tabs.diary"),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="book-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="wallet"
        options={{
          title: t("tabs.wallet"),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="ticket-outline" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
