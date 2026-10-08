import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Plus, Download, CreditCard, Receipt, Copy, BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Charge, Collection, Transaction, WorkspaceView } from "./types";
import { chargeStatus, collectionBalance, paidAmount } from "./domain";
import { useAction, euros, shortDate, datetime, downloadCSV } from "./client";
import {
  Workspace,
  Page,
  Panel,
  Metrics,
  Field,
  Select,
  Textarea,
  Checkbox,
  Feedback,
  FormActions,
  Empty,
  SearchBox,
  Status,
  labels,
  AuditTrail,
  ConfirmButton,
  person,
} from "./ui";
import { AttachmentPicker, Attachments, DocumentPanel } from "./Documents";

export function PaymentsPage() {
  return <Workspace>{(data) => <Payments data={data} />}</Workspace>;
}
function Payments({ data }: { data: WorkspaceView }) {
  const [create, setCreate] = useState(false),
    [search, setSearch] = useState("");
  const navigate = useNavigate();
  const balances = data.flow.collections.map((c) => collectionBalance(c, data.flow));
  const expected = balances.reduce((n, b) => n + b.expected, 0),
    received = balances.reduce((n, b) => n + b.received, 0);
  return (
    <Page
      title="Paiements & cotisations"
      description="Collectes, échéanciers, règlements et relances des membres."
      actions={
        <Button onClick={() => setCreate(true)}>
          <Plus />
          Créer une collecte
        </Button>
      }
    >
      <Metrics
        items={[
          { label: "Montant attendu", value: euros(expected) },
          { label: "Enregistré", value: euros(received) },
          { label: "Reste à régler", value: euros(expected - received) },
          {
            label: "Échéances en retard",
            value: data.flow.charges.filter(
              (c) => chargeStatus(c, data.flow.transactions) === "overdue",
            ).length,
          },
        ]}
      />
      <div className="flow-info">
        <CreditCard size={20} />
        <p>
          Les paiements par carte et les remboursements sont simulés. Les règlements manuels servent
          à noter un encaissement déjà effectué hors de l’application.
        </p>
      </div>
      <SearchBox value={search} onChange={setSearch} placeholder="Rechercher une collecte" />
      <div className="flow-card-grid">
        {data.flow.collections
          .filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
          .map((c) => {
            const balance = collectionBalance(c, data.flow);
            return (
              <Link className="flow-card" to={`/payments/${c.id}`} key={c.id}>
                <div className="flow-row">
                  <span className="flow-icon">
                    <CreditCard size={24} />
                  </span>
                  <Status value={c.status} />
                </div>
                <h2>{c.name}</h2>
                <p>
                  {labels[c.purpose]} · {c.memberIds.length} membres
                </p>
                <strong className="flow-large-number">
                  {euros(c.amount)}
                  <small>par membre · {c.installments} échéance(s)</small>
                </strong>
                <div className="flow-progress">
                  <span
                    style={{
                      width: `${balance.expected ? Math.min(100, (100 * balance.received) / balance.expected) : 0}%`,
                    }}
                  />
                </div>
                <div className="flow-row">
                  <small>{euros(balance.received)} enregistrés</small>
                  <small>Échéance {shortDate(c.dueDate)}</small>
                </div>
              </Link>
            );
          })}
      </div>
      {!data.flow.collections.length && (
        <Empty>Créez une collecte pour préparer les montants, les membres et les échéances.</Empty>
      )}
      {create && (
        <CollectionEditor
          data={data}
          onClose={() => setCreate(false)}
          onSaved={(id) => navigate(`/payments/${id}`)}
        />
      )}
    </Page>
  );
}
function CollectionEditor({
  data,
  collection,
  onClose,
  onSaved,
}: {
  data: WorkspaceView;
  collection?: Collection;
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const action = useAction();
  const [ids, setIds] = useState(collection?.memberIds || []),
    [attachments, setAttachments] = useState(collection?.attachmentIds || []),
    [team, setTeam] = useState("");
  const members = data.core.members.filter((m) => !team || m.team_id === team);
  return (
    <Modal title={collection ? "Modifier la collecte" : "Nouvelle collecte"} onClose={onClose} wide>
      <form
        className="flow-form"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          try {
            const result = await action.mutateAsync({
              type: "collection.save",
              payload: {
                id: collection?.id,
                name: f.get("name"),
                purpose: f.get("purpose"),
                amount: Math.round(Number(f.get("amount")) * 100),
                installments: Number(f.get("installments")),
                dueDate: f.get("dueDate"),
                description: f.get("description"),
                memberIds: ids,
                attachmentIds: attachments,
              },
            });
            onSaved(result.entityId);
            onClose();
          } catch {
            /* preserve */
          }
        }}
      >
        <div className="flow-form-grid">
          <Field
            label="Nom de la collecte"
            required
            name="name"
            defaultValue={collection?.name}
            placeholder="Cotisation saison 2026–2027"
          />
          <Select label="Objet" name="purpose" defaultValue={collection?.purpose || "membership"}>
            {["membership", "equipment", "tournament", "donation"].map((v) => (
              <option key={v} value={v}>
                {labels[v]}
              </option>
            ))}
          </Select>
          <Field
            label="Montant total par membre (€)"
            required
            name="amount"
            type="number"
            min="1"
            step="0.01"
            defaultValue={(collection?.amount || 18000) / 100}
          />
          <Select
            label="Échéancier mensuel"
            name="installments"
            defaultValue={collection?.installments || 1}
          >
            {[1, 2, 3, 4, 6, 12].map((n) => (
              <option key={n} value={n}>
                {n === 1 ? "En une fois" : `${n} mensualités`}
              </option>
            ))}
          </Select>
          <Field
            label="Première échéance"
            required
            name="dueDate"
            type="date"
            defaultValue={
              collection?.dueDate || new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)
            }
          />
        </div>
        <Textarea
          label="Description et modalités"
          name="description"
          defaultValue={collection?.description}
        />
        <Panel
          title={`${ids.length} membres sélectionnés`}
          actions={
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIds([...new Set([...ids, ...members.map((m) => m.id)])])}
            >
              Sélectionner la liste
            </Button>
          }
        >
          <Select label="Équipe" value={team} onChange={(e) => setTeam(e.target.value)}>
            <option value="">Tout le club</option>
            {data.core.teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
          <div className="recipient-picker">
            {members.map((m) => (
              <Checkbox
                key={m.id}
                checked={ids.includes(m.id)}
                label={`${m.first_name} ${m.last_name}`}
                onChange={(e) =>
                  setIds(e.target.checked ? [...ids, m.id] : ids.filter((id) => id !== m.id))
                }
              />
            ))}
          </div>
        </Panel>
        <AttachmentPicker
          data={data}
          selected={attachments}
          onChange={setAttachments}
          label="Modalités, photos ou documents de la collecte"
        />
        <Feedback error={action.error} />
        <FormActions
          pending={action.isPending}
          onClose={onClose}
          label="Enregistrer le brouillon"
        />
      </form>
    </Modal>
  );
}
export function PaymentDetailPage() {
  const { collectionId = "" } = useParams();
  return <Workspace>{(data) => <CollectionDetail data={data} id={collectionId} />}</Workspace>;
}
function CollectionDetail({ data, id }: { data: WorkspaceView; id: string }) {
  const collection = data.flow.collections.find((c) => c.id === id);
  const action = useAction(),
    navigate = useNavigate();
  const [edit, setEdit] = useState(false),
    [chargeId, setCharge] = useState<string | null>(null),
    [search, setSearch] = useState(""),
    [filter, setFilter] = useState("");
  if (!collection) return <Empty>Collecte introuvable.</Empty>;
  const balance = collectionBalance(collection, data.flow);
  const charges = data.flow.charges.filter((c) => c.collectionId === id);
  const shown = charges.filter(
    (c) =>
      person(data, c.memberId).toLowerCase().includes(search.toLowerCase()) &&
      (!filter || chargeStatus(c, data.flow.transactions) === filter),
  );
  const selected = charges.find((c) => c.id === chargeId);
  const send = (type: string, payload: Record<string, unknown> = {}) =>
    action.mutateAsync({ type, payload: { id, ...payload } });
  return (
    <Page
      title={collection.name}
      back="/payments"
      description={`${labels[collection.purpose]} · ${euros(collection.amount)} par membre · ${collection.installments} échéance(s)`}
      actions={
        <>
          <Status value={collection.status} />
          <Button
            variant="outline"
            disabled={action.isPending}
            onClick={() =>
              void send("collection.duplicate")
                .then((r) => navigate(`/payments/${r.entityId}`))
                .catch(() => {})
            }
          >
            <Copy />
            Dupliquer
          </Button>
          {collection.status === "draft" && <Button onClick={() => setEdit(true)}>Modifier</Button>}
        </>
      }
    >
      <Feedback error={action.error} success={action.data?.message} />
      <Metrics
        items={[
          { label: "Attendu", value: euros(balance.expected) },
          { label: "Enregistré", value: euros(balance.received) },
          { label: "Reste à régler", value: euros(balance.expected - balance.received) },
          { label: "Échéances réglées", value: `${balance.paid} / ${balance.count}` },
        ]}
      />
      <Panel
        title="Gestion de la collecte"
        actions={
          <>
            {collection.status === "draft" && (
              <ConfirmButton
                label="Ouvrir la collecte"
                title="Créer les échéances ?"
                onConfirm={() => send("collection.open")}
                pending={action.isPending}
              >
                Les montants et les destinataires seront figés. Les échéances seront créées pour{" "}
                {collection.memberIds.length} membres.
              </ConfirmButton>
            )}
            {collection.status === "open" && (
              <>
                <Button
                  variant="outline"
                  disabled={action.isPending}
                  onClick={() =>
                    void send("collection.remind", { channel: "email" })
                      .then((r) => navigate(`/campaigns/${r.entityId}`))
                      .catch(() => {})
                  }
                >
                  <BellRing />
                  Préparer une relance
                </Button>
                <ConfirmButton
                  label="Clôturer"
                  title="Clôturer cette collecte ?"
                  onConfirm={() => send("collection.close")}
                  pending={action.isPending}
                >
                  Les nouveaux règlements seront bloqués. L’historique et les remboursements
                  resteront disponibles.
                </ConfirmButton>
              </>
            )}
          </>
        }
      >
        <p>{collection.description || "Aucune description ajoutée."}</p>
        <Attachments ids={collection.attachmentIds} data={data} />
      </Panel>
      <Tabs defaultValue="charges">
        <TabsList>
          <TabsTrigger value="charges">Règlements et échéances</TabsTrigger>
          <TabsTrigger value="files">Documents</TabsTrigger>
          <TabsTrigger value="history">Historique</TabsTrigger>
        </TabsList>
        <TabsContent value="charges">
          <Panel
            title="Suivi des membres"
            actions={
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  downloadCSV("collecte.csv", [
                    ["Membre", "Échéance", "Date", "Montant", "Réglé", "Reste", "Statut"],
                    ...charges.map((c) => [
                      person(data, c.memberId),
                      c.installment,
                      c.dueDate,
                      c.amount / 100,
                      paidAmount(c.id, data.flow.transactions) / 100,
                      (c.amount - paidAmount(c.id, data.flow.transactions)) / 100,
                      labels[chargeStatus(c, data.flow.transactions)],
                    ]),
                  ])
                }
              >
                <Download />
                Exporter
              </Button>
            }
          >
            <div className="flow-toolbar">
              <SearchBox value={search} onChange={setSearch} />
              <Select
                label="État du règlement"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                <option value="">Tous les états</option>
                {[
                  "paid",
                  "partial",
                  "unpaid",
                  "overdue",
                  "pending",
                  "failed",
                  "refunded",
                  "exempt",
                  "cancelled",
                ].map((s) => (
                  <option key={s} value={s}>
                    {labels[s]}
                  </option>
                ))}
              </Select>
            </div>
            {shown.length ? (
              <div className="flow-table-wrap">
                <table className="flow-table">
                  <thead>
                    <tr>
                      <th>Membre</th>
                      <th>Échéance</th>
                      <th>Montant</th>
                      <th>Réglé</th>
                      <th>Statut</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((c) => (
                      <tr key={c.id}>
                        <td>
                          <Link className="flow-link" to={`/members/${c.memberId}`}>
                            {person(data, c.memberId)}
                          </Link>
                        </td>
                        <td>
                          {shortDate(c.dueDate)}
                          <small>
                            {c.installment} / {collection.installments}
                          </small>
                        </td>
                        <td>{euros(c.amount)}</td>
                        <td>{euros(paidAmount(c.id, data.flow.transactions))}</td>
                        <td>
                          <Status value={chargeStatus(c, data.flow.transactions)} />
                        </td>
                        <td>
                          <Button size="sm" variant="outline" onClick={() => setCharge(c.id)}>
                            Gérer
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty>
                {collection.status === "draft"
                  ? "Ouvrez la collecte pour générer les échéances."
                  : "Aucun règlement dans cette vue."}
              </Empty>
            )}
          </Panel>
        </TabsContent>
        <TabsContent value="files">
          <DocumentPanel data={data} entityType="collection" entityId={id} />
        </TabsContent>
        <TabsContent value="history">
          <Panel title="Historique financier">
            <AuditTrail data={data} entityId={id} />
          </Panel>
        </TabsContent>
      </Tabs>
      {edit && (
        <CollectionEditor
          data={data}
          collection={collection}
          onSaved={() => {}}
          onClose={() => setEdit(false)}
        />
      )}{" "}
      {selected && (
        <ChargeModal
          data={data}
          charge={selected}
          collection={collection}
          onClose={() => setCharge(null)}
        />
      )}
    </Page>
  );
}
function ChargeModal({
  data,
  charge,
  collection,
  onClose,
}: {
  data: WorkspaceView;
  charge: Charge;
  collection: Collection;
  onClose: () => void;
}) {
  const action = useAction();
  const paid = paidAmount(charge.id, data.flow.transactions);
  const transactions = data.flow.transactions.filter((t) => t.chargeId === charge.id);
  const [mode, setMode] = useState<"payment" | "refund">("payment"),
    [method, setMethod] = useState("card");
  const [amount, setAmount] = useState(String(Math.max(0, charge.amount - paid) / 100));
  const pending = transactions.some((t) => t.status === "pending");
  return (
    <Modal
      title={`${person(data, charge.memberId)} · Échéance ${charge.installment}`}
      onClose={onClose}
      wide
    >
      <Metrics
        items={[
          { label: "À régler", value: euros(charge.amount) },
          { label: "Enregistré", value: euros(paid) },
          { label: "Solde", value: euros(charge.amount - paid) },
        ]}
      />
      <div className="flow-row">
        <Status value={chargeStatus(charge, data.flow.transactions)} />
        <div className="flow-actions">
          {paid === 0 && !pending && !charge.cancelled && (
            <ConfirmButton
              label={charge.exempt ? "Retirer l’exonération" : "Exonérer"}
              title="Modifier l’exonération ?"
              pending={action.isPending}
              onConfirm={() =>
                action.mutateAsync({ type: "charge.exempt", payload: { id: charge.id } })
              }
            >
              L’échéance sera incluse ou exclue du montant attendu.
            </ConfirmButton>
          )}
          {paid === 0 && !pending && !charge.cancelled && (
            <ConfirmButton
              label="Annuler l’échéance"
              title="Annuler cette échéance ?"
              onConfirm={() =>
                action.mutateAsync({ type: "charge.cancel", payload: { id: charge.id } })
              }
              pending={action.isPending}
            >
              Cette échéance ne sera plus demandée au membre.
            </ConfirmButton>
          )}
        </div>
      </div>
      <Tabs defaultValue="payment">
        <TabsList>
          <TabsTrigger value="payment">Règlement / remboursement</TabsTrigger>
          <TabsTrigger value="history">Transactions</TabsTrigger>
          <TabsTrigger value="files">Justificatifs</TabsTrigger>
        </TabsList>
        <TabsContent value="payment">
          <form
            className="flow-form"
            onSubmit={async (e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              try {
                await action.mutateAsync({
                  type: mode === "refund" ? "payment.refund" : "payment.record",
                  payload: {
                    chargeId: charge.id,
                    amount: Math.round(Number(amount) * 100),
                    method,
                    status: form.get("status") || "succeeded",
                    note: form.get("note"),
                  },
                });
                setAmount("");
              } catch {
                /* preserve */
              }
            }}
          >
            <div className="flow-form-grid">
              <Select
                label="Opération"
                value={mode}
                onChange={(e) => {
                  const next = e.target.value as typeof mode;
                  setMode(next);
                  setAmount(String((next === "refund" ? paid : charge.amount - paid) / 100));
                }}
              >
                <option value="payment">Enregistrer un règlement</option>
                <option value="refund">Simuler un remboursement</option>
              </Select>
              <Field
                label="Montant (€)"
                type="number"
                min="0.01"
                step="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                max={(mode === "refund" ? paid : charge.amount - paid) / 100}
              />
              <Select
                label="Moyen de règlement"
                value={method}
                onChange={(e) => setMethod(e.target.value)}
              >
                {["card", "cash", "transfer", "cheque"].map((v) => (
                  <option key={v} value={v}>
                    {labels[v]}
                  </option>
                ))}
              </Select>
              {method === "card" && mode === "payment" && (
                <Select label="Résultat à simuler" name="status" defaultValue="succeeded">
                  <option value="succeeded">Paiement réussi</option>
                  <option value="pending">Authentification en attente</option>
                  <option value="failed">Paiement refusé</option>
                </Select>
              )}
            </div>
            <Textarea
              label={
                mode === "refund" ? "Motif du remboursement" : "Référence ou note du règlement"
              }
              name="note"
              required={mode === "refund"}
            />
            <p className="flow-muted">
              {method === "card" || mode === "refund"
                ? "Aucune carte bancaire n’est demandée. Aucun débit ni remboursement réel n’a lieu."
                : "Enregistrez ici un règlement reçu hors de l’application."}
            </p>
            <Button
              disabled={
                action.isPending ||
                (mode === "payment" &&
                  (collection.status !== "open" || charge.cancelled || charge.exempt || pending))
              }
            >
              {mode === "refund"
                ? "Confirmer le remboursement simulé"
                : method === "card"
                  ? "Simuler le paiement"
                  : "Confirmer le règlement manuel"}
            </Button>
          </form>
        </TabsContent>
        <TabsContent value="history">
          {transactions.length ? (
            <div className="transaction-list">
              {transactions.map((t) => (
                <div key={t.id}>
                  <div>
                    <strong>
                      {t.kind === "refund" ? "Remboursement" : "Règlement"} · {euros(t.amount)}
                    </strong>
                    <small>
                      {t.reference} · {datetime(t.createdAt)}
                    </small>
                    <small>
                      {labels[t.method]}
                      {t.note && ` · ${t.note}`}
                    </small>
                  </div>
                  <Status value={t.status} />
                  {t.status === "pending" && (
                    <div className="flow-actions">
                      <Button
                        size="sm"
                        onClick={() =>
                          action.mutate({
                            type: "payment.resolve",
                            payload: { id: t.id, status: "succeeded" },
                          })
                        }
                      >
                        Simuler la validation
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          action.mutate({
                            type: "payment.resolve",
                            payload: { id: t.id, status: "failed" },
                          })
                        }
                      >
                        Simuler le refus
                      </Button>
                    </div>
                  )}
                  {t.status === "succeeded" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => receipt(data, collection, charge, t)}
                    >
                      <Receipt />
                      Reçu
                    </Button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <Empty>Aucune transaction enregistrée.</Empty>
          )}
        </TabsContent>
        <TabsContent value="files">
          <DocumentPanel
            data={data}
            entityType="charge"
            entityId={charge.id}
            title="Justificatifs de règlement"
          />
        </TabsContent>
      </Tabs>
      <Feedback error={action.error} success={action.data?.message} />
    </Modal>
  );
}
function receipt(
  data: WorkspaceView,
  collection: Collection,
  charge: Charge,
  transaction: Transaction,
) {
  const escape = (value: string) =>
    value.replace(
      /[&<>"']/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
    );
  const content = `<!doctype html><html lang="fr"><meta charset="utf-8"><title>Reçu ${escape(transaction.reference)}</title><style>body{font:16px system-ui;max-width:720px;margin:60px auto;color:#16332c;padding:24px}h1{font-size:32px}hr{border:0;border-top:1px solid #ccc;margin:25px 0}small{color:#666}strong{font-size:24px}</style><h1>${transaction.kind === "refund" ? "Reçu de remboursement" : "Reçu de règlement"}</h1><p>${escape(data.core.clubs[0].name)}</p><hr><p>Référence : ${escape(transaction.reference)}</p><p>Membre : ${escape(person(data, charge.memberId))}</p><p>Objet : ${escape(collection.name)} · Échéance ${charge.installment}</p><p>Date : ${escape(datetime(transaction.createdAt))}</p><p>Moyen : ${escape(labels[transaction.method])}</p><strong>${escape(euros(transaction.amount))}</strong><hr><small>${transaction.simulated ? "Document de démonstration — transaction simulée, sans mouvement bancaire." : "Justificatif interne d’un règlement déclaré manuellement par le gestionnaire."}</small><p><button onclick="window.print()">Imprimer / enregistrer en PDF</button></p></html>`;
  const blob = new Blob([content], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener");
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
