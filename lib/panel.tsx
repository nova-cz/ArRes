"use client";
import { createContext, useContext } from "react";

export type Restaurante = { id: string; nombre: string };
export const RestauranteCtx = createContext<Restaurante | null>(null);
export const useRestaurante = () => useContext(RestauranteCtx)!;
