import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import type { TwilioTestConfig, TwilioTestRecord } from "./twilio-types";
import { api, datetime } from "./client";
import { Panel, Field, Textarea, Feedback, ConfirmButton } from "./ui";

const labels: Record<string, string> = {
  accepted: "Accepté par Twilio",
  queued: "En file d’attente",
  sending: "En cours d’envoi",
  sent: "Envoyé à l’opérateur",
  delivered: "Distribué",
  undelivered: "Non distribué",
  failed: "Échec",
  unknown: "Envoi non confirmé",
  canceled: "Annulé",
};
export function TwilioTest() {
  const [body, setBody] = useState("Foot Easy : test SMS local.");
  const qc = useQueryClient();
  const config = useQuery({
    queryKey: ["twilio-config"],
    queryFn: () => api<TwilioTestConfig>("/api/v2/providers/twilio"),
    retry: false,
  });
  const send = useMutation({
    retry: false,
    mutationFn: () =>
      api<TwilioTestRecord>("/api/v2/providers/twilio/test", {
        method: "POST",
        headers: { "X-Request-Id": crypto.randomUUID() },
        body: JSON.stringify({ to: config.data?.to, body, confirm: true }),
      }),
    onSettled: () => qc.invalidateQueries({ queryKey: ["twilio-config"] }),
  });
  const previous = send.data || config.data?.lastTest;
  const tracking = useQuery({
    queryKey: ["twilio-test", previous?.id],
    queryFn: () => api<TwilioTestRecord>(`/api/v2/providers/twilio/test/${previous!.id}`),
    enabled: !!previous?.sid && !!config.data?.local,
    retry: false,
    refetchInterval: (query) =>
      query.state.data &&
      ["accepted", "queued", "sending", "sent"].includes(query.state.data.status) &&
      Date.now() - Date.parse(query.state.data.createdAt) < 120000
        ? 5000
        : false,
  });
  if (!config.data?.local) return null;
  const current = tracking.data || previous;
  return (
    <Panel title="Twilio · test SMS local">
      <p>
        Renseigne tes identifiants dans <code>front/.dev.vars</code>, puis redémarre{" "}
        <code>npm run dev</code>. Ils restent sur le serveur local.
      </p>
      <p>
        <strong>
          {config.data.ready ? "Identifiants configurés" : "Configuration à compléter"}
        </strong>{" "}
        · {config.data.authMode}
      </p>
      {!!config.data.missing.length && (
        <p className="flow-muted">
          Champs manquants ou invalides : {config.data.missing.join(", ")}.
        </p>
      )}
      {!config.data.enabled && (
        <p className="flow-muted">
          Pour autoriser le test réel, renseigne <code>TWILIO_TEST_ENABLED=true</code>, puis
          redémarre le serveur.
        </p>
      )}
      <Field label="Numéro destinataire du test" type="tel" value={config.data.to} readOnly />
      {config.data.sender && <p className="flow-muted">Expéditeur : {config.data.sender}</p>}
      <Textarea
        label="Message du SMS de test"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={1600}
      />
      {config.data.ready && config.data.enabled && (
        <ConfirmButton
          label="Envoyer un SMS réel de test"
          title="Confirmer le SMS réel ?"
          pending={send.isPending}
          onConfirm={async () => {
            await send.mutateAsync();
          }}
        >
          Le SMS sera envoyé à {config.data.to} et peut être facturé par Twilio. Message : {body}
        </ConfirmButton>
      )}
      <p className="flow-muted">
        Avec un compte d’essai, vérifie ce numéro dans la console Twilio. Seul TWILIO_TEST_TO peut
        recevoir ce test. Les campagnes du club conservent leur simulation.
      </p>
      {current && (
        <div className="flow-info">
          <div>
            <strong>Dernier test : {labels[current.status] || current.status}</strong>
            <p>{current.detail}</p>
            <small>
              Destinataire : {current.to} · {datetime(current.updatedAt)}
            </small>
            {current.sid && (
              <p>
                Identifiant Twilio : <code>{current.sid}</code>
              </p>
            )}
            {current.errorCode && <p>Code Twilio : {current.errorCode}</p>}
            {current.sid && (
              <Button
                variant="outline"
                disabled={tracking.isFetching}
                onClick={() => void tracking.refetch()}
              >
                {tracking.isFetching ? "Actualisation…" : "Actualiser le suivi"}
              </Button>
            )}
          </div>
        </div>
      )}
      <Feedback error={tracking.error} />
    </Panel>
  );
}
