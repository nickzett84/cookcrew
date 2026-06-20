import type { ParsedRecipe } from '../lib/api';

export type RootStackParamList = {
  Landing: undefined;
  CreateKitchen: undefined;
  JoinKitchen: undefined;
  Lobby: undefined;
  RecipeImport: undefined;
  RecipeReview: { parsed: ParsedRecipe };
  Cooking: undefined;
  Settings: undefined;
};
