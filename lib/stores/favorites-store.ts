"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo } from "react";
import { create } from "zustand";
import { useAuthStore } from "@/lib/stores/auth-store";
import { createClient } from "@/lib/supabase/client";

interface FavoriteStock {
	symbol: string;
	name: string;
	addedAt: Date;
}

interface FavoritesState {
	favorites: FavoriteStock[];
	setFavorites: (favorites: FavoriteStock[]) => void;
	addFavorite: (favorite: FavoriteStock) => void;
	removeFavorite: (symbol: string) => void;
}

interface FavoriteMutationInput {
	symbol: string;
	name: string;
}

const useFavoritesStore = create<FavoritesState>((set) => ({
	favorites: [],
	setFavorites: (favorites) => set({ favorites }),
	addFavorite: (favorite) =>
		set((state) => ({
			favorites: [favorite, ...state.favorites.filter((item) => item.symbol !== favorite.symbol)],
		})),
	removeFavorite: (symbol) =>
		set((state) => ({
			favorites: state.favorites.filter((favorite) => favorite.symbol !== symbol.toUpperCase()),
		})),
}));

export function useFavorites() {
	const user = useAuthStore((state) => state.user);
	const supabase = useMemo(() => createClient(), []);
	const queryClient = useQueryClient();
	const favorites = useFavoritesStore((state) => state.favorites);
	const setFavorites = useFavoritesStore((state) => state.setFavorites);
	const addFavorite = useFavoritesStore((state) => state.addFavorite);
	const removeFavorite = useFavoritesStore((state) => state.removeFavorite);
	const queryKey = ["favorites", user?.id ?? "anonymous"];

	const favoritesQuery = useQuery({
		queryKey,
		enabled: !!user,
		queryFn: async () => {
			if (!user) {
				return [];
			}

			const { data, error } = await supabase
				.from("favorites")
				.select("symbol, created_at")
				.eq("user_id", user.id)
				.order("created_at", { ascending: false });

			if (error) {
				throw error;
			}

			return (
				data?.map((favorite) => ({
					symbol: favorite.symbol,
					name: favorite.symbol,
					addedAt: new Date(favorite.created_at),
				})) ?? []
			);
		},
	});

	useEffect(() => {
		if (!user) {
			setFavorites([]);
			return;
		}

		if (favoritesQuery.data) {
			setFavorites(favoritesQuery.data);
		}
	}, [favoritesQuery.data, setFavorites, user]);

	const addMutation = useMutation({
		mutationFn: async ({ symbol }: FavoriteMutationInput) => {
			if (!user) {
				return;
			}

			const { error } = await supabase.from("favorites").insert([
				{
					user_id: user.id,
					symbol,
				},
			]);

			if (error) {
				throw error;
			}
		},
		onMutate: async ({ symbol, name }) => {
			await queryClient.cancelQueries({ queryKey });
			const previousFavorites = useFavoritesStore.getState().favorites;
			addFavorite({ symbol, name, addedAt: new Date() });
			return { previousFavorites };
		},
		onError: (_error, _variables, context) => {
			if (context?.previousFavorites) {
				setFavorites(context.previousFavorites);
			}
		},
		onSettled: () => {
			void queryClient.invalidateQueries({ queryKey });
		},
	});

	const removeMutation = useMutation({
		mutationFn: async (symbol: string) => {
			if (!user) {
				return;
			}

			const { error } = await supabase
				.from("favorites")
				.delete()
				.eq("user_id", user.id)
				.eq("symbol", symbol);

			if (error) {
				throw error;
			}
		},
		onMutate: async (symbol) => {
			await queryClient.cancelQueries({ queryKey });
			const previousFavorites = useFavoritesStore.getState().favorites;
			removeFavorite(symbol);
			return { previousFavorites };
		},
		onError: (_error, _variables, context) => {
			if (context?.previousFavorites) {
				setFavorites(context.previousFavorites);
			}
		},
		onSettled: () => {
			void queryClient.invalidateQueries({ queryKey });
		},
	});

	const addToFavorites = useCallback(
		async (symbol: string, name: string) => {
			if (!user) {
				return;
			}

			const normalizedSymbol = symbol.toUpperCase();
			if (favorites.some((favorite) => favorite.symbol === normalizedSymbol)) {
				return;
			}

			await addMutation.mutateAsync({ symbol: normalizedSymbol, name });
		},
		[addMutation, favorites, user],
	);

	const removeFromFavorites = useCallback(
		async (symbol: string) => {
			if (!user) {
				return;
			}

			await removeMutation.mutateAsync(symbol.toUpperCase());
		},
		[removeMutation, user],
	);

	const isFavorite = useCallback(
		(symbol: string) => favorites.some((favorite) => favorite.symbol === symbol.toUpperCase()),
		[favorites],
	);

	return {
		favorites,
		addToFavorites,
		removeFromFavorites,
		isFavorite,
		loading: favoritesQuery.isLoading || addMutation.isPending || removeMutation.isPending,
	};
}
