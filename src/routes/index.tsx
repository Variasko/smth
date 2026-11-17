import { createFileRoute } from "@tanstack/react-router";
import { Album } from "@/components/album";

export const Route = createFileRoute("/")({ component: Album });
