import { createFileRoute } from "@tanstack/react-router";
import { PresentersPage } from "@/features/presenters/PresentersPage";
export const Route = createFileRoute("/_app/presentatoren")({ component: PresentersPage });
