import { SymbolView } from "expo-symbols";
import { Tabs } from "expo-router";
import { useColorScheme } from "react-native";

import { colorsFor } from "@/src/theme";

export default function TabLayout() {
  const colors = colorsFor(useColorScheme());
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.blue,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.panel, borderTopColor: colors.line },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "700" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Explorer",
          tabBarIcon: ({ color }) => <SymbolView name="tablecells" tintColor={color} size={22} />,
        }}
      />
      <Tabs.Screen
        name="definitions"
        options={{
          title: "Definitions",
          tabBarIcon: ({ color }) => <SymbolView name="list.bullet.rectangle" tintColor={color} size={22} />,
        }}
      />
      <Tabs.Screen
        name="errors"
        options={{
          title: "Errors",
          tabBarIcon: ({ color }) => <SymbolView name="checkmark.circle" tintColor={color} size={22} />,
        }}
      />
      <Tabs.Screen
        name="about"
        options={{
          title: "About",
          tabBarIcon: ({ color }) => <SymbolView name="info.circle" tintColor={color} size={22} />,
        }}
      />
    </Tabs>
  );
}
