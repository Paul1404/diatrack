import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Trash2 } from "lucide-react";
import { useState } from "react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { formatDateTime } from "~/lib/format";
import { orpc } from "~/lib/orpc";

const STATUS_VARIANT = {
  success: "success",
  failed: "destructive",
  skipped: "secondary",
} as const;

export function EmailLogsPanel() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<"all" | "success" | "failed" | "skipped">("all");

  const logsQuery = useQuery(
    orpc.admin.listEmailLogs.queryOptions({
      input: { limit: 50, offset: 0, status: status === "all" ? undefined : status },
    }),
  );

  const clearMutation = useMutation(
    orpc.admin.clearEmailLogs.mutationOptions({
      onSuccess: () => queryClient.invalidateQueries({ queryKey: orpc.admin.listEmailLogs.key() }),
    }),
  );

  const entries = logsQuery.data?.entries ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Status</SelectItem>
            <SelectItem value="success">Erfolgreich</SelectItem>
            <SelectItem value="failed">Fehlgeschlagen</SelectItem>
            <SelectItem value="skipped">Übersprungen</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="sm"
          onClick={() => clearMutation.mutate({})}
          disabled={clearMutation.isPending || entries.length === 0}
        >
          <Trash2 />
          Leeren
        </Button>
      </div>

      {logsQuery.isLoading ? (
        <div className="flex justify-center py-10 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : entries.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Keine E-Mail-Logs.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Zeit</TableHead>
              <TableHead>Empfänger</TableHead>
              <TableHead>Betreff</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((e) => (
              <TableRow key={e.id}>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {formatDateTime(e.createdAt)}
                </TableCell>
                <TableCell>{e.toEmail}</TableCell>
                <TableCell className="max-w-[16rem] truncate">{e.subject}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[e.status]}>{e.statusLabel}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
