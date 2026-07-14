import { createFileRoute } from "@tanstack/react-router";
import { RundownPage } from "@/features/rundown/RundownPage";
export const Route = createFileRoute("/_app/draaiboek/$entryId")({ component: RundownPage });
