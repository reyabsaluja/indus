"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useAuth } from "./AuthContext";
import { createClient } from "@/lib/supabase/client";

interface FavoriteStock {
  symbol: string;
  name: string;
  addedAt: Date;
}

interface FavoritesContextType {
  favorites: FavoriteStock[];
  addToFavorites: (symbol: string, name: string) => Promise<void>;
  removeFromFavorites: (symbol: string) => Promise<void>;
  isFavorite: (symbol: string) => boolean;
  loading: boolean;
}

const FavoritesContext = createContext<FavoritesContextType | undefined>(
  undefined
);

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const [favorites, setFavorites] = useState<FavoriteStock[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const supabase = createClient();

  // Load favorites from Supabase when user changes
  useEffect(() => {
    if (user) {
      loadFavorites();
    } else {
      setFavorites([]);
      setLoading(false);
    }
  }, [user]);

  const loadFavorites = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("favorites")
        .select("symbol, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error loading favorites:", error);
        return;
      }

      const favoritesData =
        data?.map((fav) => ({
          symbol: fav.symbol,
          name: fav.symbol, // We'll store just symbol for now, could fetch company names later
          addedAt: new Date(fav.created_at),
        })) || [];

      setFavorites(favoritesData);
    } catch (error) {
      console.error("Error loading favorites:", error);
    } finally {
      setLoading(false);
    }
  };

  const addToFavorites = async (symbol: string, name: string) => {
    if (!user || favorites.some((fav) => fav.symbol === symbol)) {
      return;
    }

    try {
      const { error } = await supabase.from("favorites").insert([
        {
          user_id: user.id,
          symbol: symbol.toUpperCase(),
        },
      ]);

      if (error) {
        console.error("Error adding favorite:", error);
        return;
      }

      // Optimistically update local state
      setFavorites((prev) => [
        {
          symbol: symbol.toUpperCase(),
          name,
          addedAt: new Date(),
        },
        ...prev,
      ]);
    } catch (error) {
      console.error("Error adding favorite:", error);
    }
  };

  const removeFromFavorites = async (symbol: string) => {
    if (!user || !favorites.some((fav) => fav.symbol === symbol)) {
      return;
    }

    try {
      const { error } = await supabase
        .from("favorites")
        .delete()
        .eq("user_id", user.id)
        .eq("symbol", symbol.toUpperCase());

      if (error) {
        console.error("Error removing favorite:", error);
        return;
      }

      // Optimistically update local state
      setFavorites((prev) =>
        prev.filter((fav) => fav.symbol !== symbol.toUpperCase())
      );
    } catch (error) {
      console.error("Error removing favorite:", error);
    }
  };

  const isFavorite = (symbol: string) => {
    return favorites.some((fav) => fav.symbol === symbol.toUpperCase());
  };

  return (
    <FavoritesContext.Provider
      value={{
        favorites,
        addToFavorites,
        removeFromFavorites,
        isFavorite,
        loading,
      }}
    >
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites() {
  const context = useContext(FavoritesContext);
  if (context === undefined) {
    throw new Error("useFavorites must be used within a FavoritesProvider");
  }
  return context;
}
