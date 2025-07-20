"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Star, Loader2 } from "lucide-react";
import { useFavorites } from "@/lib/context/FavoritesContext";
import { cn } from "@/lib/utils";

interface FavoriteButtonProps {
  symbol: string;
  className?: string;
  size?: "sm" | "default" | "lg";
  variant?: "default" | "outline" | "ghost";
}

export function FavoriteButton({
  symbol,
  className,
  size = "default",
  variant = "outline",
}: FavoriteButtonProps) {
  const { favorites, addToFavorites, removeFromFavorites, loading } =
    useFavorites();
  const [isToggling, setIsToggling] = useState(false);

  const isFavorited = favorites.some((fav) => fav.symbol === symbol);

  const handleToggleFavorite = async () => {
    if (isToggling) return;

    try {
      setIsToggling(true);

      if (isFavorited) {
        await removeFromFavorites(symbol);
      } else {
        // Get company name - in a real app, this would come from props or API
        const companyName =
          symbol === "AAPL"
            ? "Apple Inc."
            : symbol === "GOOGL"
            ? "Alphabet Inc."
            : symbol === "MSFT"
            ? "Microsoft Corporation"
            : symbol === "TSLA"
            ? "Tesla Inc."
            : symbol === "NVDA"
            ? "NVIDIA Corporation"
            : "Company Name";
        await addToFavorites(symbol, companyName);
      }
    } catch (error) {
      console.error("Failed to toggle favorite:", error);
    } finally {
      setIsToggling(false);
    }
  };

  const isLoading = loading || isToggling;

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleToggleFavorite}
      disabled={isLoading}
      className={cn(
        "transition-all duration-200 hover:scale-105 active:scale-95",
        isFavorited &&
          "bg-yellow-50 border-yellow-300 hover:bg-yellow-100 dark:bg-yellow-950 dark:border-yellow-700 dark:hover:bg-yellow-900",
        className
      )}
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Star
          className={cn(
            "h-4 w-4 transition-all duration-200",
            isFavorited
              ? "fill-yellow-400 text-yellow-400"
              : "text-muted-foreground hover:text-yellow-400"
          )}
        />
      )}
      <span className="ml-2">
        {isFavorited ? "Remove from Favorites" : "Add to Favorites"}
      </span>
    </Button>
  );
}

// Compact version for use in cards or tight spaces
export function FavoriteButtonCompact({
  symbol,
  className,
}: Pick<FavoriteButtonProps, "symbol" | "className">) {
  const { favorites, addToFavorites, removeFromFavorites, loading } =
    useFavorites();
  const [isToggling, setIsToggling] = useState(false);

  const isFavorited = favorites.some((fav) => fav.symbol === symbol);

  const handleToggleFavorite = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering parent click events

    if (isToggling) return;

    try {
      setIsToggling(true);

      if (isFavorited) {
        await removeFromFavorites(symbol);
      } else {
        // Get company name - in a real app, this would come from props or API
        const companyName =
          symbol === "AAPL"
            ? "Apple Inc."
            : symbol === "GOOGL"
            ? "Alphabet Inc."
            : symbol === "MSFT"
            ? "Microsoft Corporation"
            : symbol === "TSLA"
            ? "Tesla Inc."
            : symbol === "NVDA"
            ? "NVIDIA Corporation"
            : "Company Name";
        await addToFavorites(symbol, companyName);
      }
    } catch (error) {
      console.error("Failed to toggle favorite:", error);
    } finally {
      setIsToggling(false);
    }
  };

  const isLoading = loading || isToggling;

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleToggleFavorite}
      disabled={isLoading}
      className={cn(
        "h-8 w-8 p-0 transition-all duration-200 hover:scale-110 active:scale-95",
        isFavorited && "hover:bg-yellow-100 dark:hover:bg-yellow-900/20",
        className
      )}
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Star
          className={cn(
            "h-4 w-4 transition-all duration-200",
            isFavorited
              ? "fill-yellow-400 text-yellow-400"
              : "text-muted-foreground hover:text-yellow-400"
          )}
        />
      )}
    </Button>
  );
}
