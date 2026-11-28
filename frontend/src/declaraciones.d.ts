/// <reference types="react" />

declare module "react-native" {
  import * as React from "react";

  export interface ViewStyle {
    [key: string]: any;
  }
  export interface TextStyle {
    [key: string]: any;
  }
  export interface ImageStyle {
    [key: string]: any;
  }

  export type StyleProp<T> = T | Array<T | undefined | null | false> | undefined | null | false;

  export interface ViewProps {
    style?: StyleProp<ViewStyle>;
    children?: React.ReactNode;
    [key: string]: any;
  }

  export interface TextProps {
    style?: StyleProp<TextStyle>;
    children?: React.ReactNode;
    [key: string]: any;
  }

  export interface TextInputProps {
    value?: string;
    onChangeText?: (text: string) => void;
    onFocus?: () => void;
    onBlur?: () => void;
    placeholder?: string;
    placeholderTextColor?: string;
    keyboardType?: string;
    autoCapitalize?: "none" | "sentences" | "words" | "characters";
    style?: StyleProp<TextStyle>;
    [key: string]: any;
  }

  export interface TouchableOpacityProps {
    onPress?: () => void;
    disabled?: boolean;
    activeOpacity?: number;
    style?: StyleProp<ViewStyle>;
    accessibilityLabel?: string;
    children?: React.ReactNode;
    [key: string]: any;
  }

  export interface PressableProps {
    onPress?: (event?: any) => void;
    style?: any;
    children?: React.ReactNode;
    [key: string]: any;
  }

  export interface ModalProps {
    visible?: boolean;
    transparent?: boolean;
    animationType?: "none" | "slide" | "fade";
    onRequestClose?: () => void;
    children?: React.ReactNode;
    [key: string]: any;
  }

  export interface ScrollViewProps {
    style?: StyleProp<ViewStyle>;
    contentContainerStyle?: StyleProp<ViewStyle>;
    children?: React.ReactNode;
    [key: string]: any;
  }

  export const View: React.FC<ViewProps>;
  export const Text: React.FC<TextProps>;
  export const TextInput: React.FC<TextInputProps>;
  export const TouchableOpacity: React.FC<TouchableOpacityProps>;
  export const Pressable: React.FC<PressableProps>;
  export const Modal: React.FC<ModalProps>;
  export const ScrollView: React.FC<ScrollViewProps>;
  export const FlatList: any;

  export const StyleSheet: {
    create: <T extends Record<string, any>>(styles: T) => T;
  };

  export const Platform: {
    OS: "ios" | "android" | "windows" | "macos" | "web";
    select: (obj: any) => any;
  };
}

declare module "@expo/vector-icons" {
  import * as React from "react";
  export interface IconProps {
    name: string;
    size?: number;
    color?: string;
    style?: any;
  }
  export const Ionicons: React.FC<IconProps>;
  export const MaterialIcons: React.FC<IconProps>;
  export const FontAwesome: React.FC<IconProps>;
  export const Feather: React.FC<IconProps>;
}

declare module "@expo/vector-icons/Ionicons" {
  import * as React from "react";
  const Ionicons: React.FC<any>;
  export default Ionicons;
}
