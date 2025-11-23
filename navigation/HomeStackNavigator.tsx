import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import RootStackNavigator from "./RootStackNavigator";

const Stack = createNativeStackNavigator();

export default function HomeStackNavigator() {
  return <RootStackNavigator />;
}
