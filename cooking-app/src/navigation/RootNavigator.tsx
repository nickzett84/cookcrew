import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LandingScreen } from '../screens/LandingScreen';
import { CreateKitchenScreen } from '../screens/CreateKitchenScreen';
import { JoinKitchenScreen } from '../screens/JoinKitchenScreen';
import { LobbyScreen } from '../screens/LobbyScreen';
import { RecipeImportScreen } from '../screens/RecipeImportScreen';
import { RecipeReviewScreen } from '../screens/RecipeReviewScreen';
import { CookingScreen } from '../screens/CookingScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { RootStackParamList } from './types';
import { colors } from '../theme';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.paper },
      }}
    >
      <Stack.Screen name="Landing" component={LandingScreen} />
      <Stack.Screen name="CreateKitchen" component={CreateKitchenScreen} />
      <Stack.Screen name="JoinKitchen" component={JoinKitchenScreen} />
      <Stack.Screen name="Lobby" component={LobbyScreen} />
      <Stack.Screen name="RecipeImport" component={RecipeImportScreen} />
      <Stack.Screen name="RecipeReview" component={RecipeReviewScreen} />
      <Stack.Screen name="Cooking" component={CookingScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
    </Stack.Navigator>
  );
}
