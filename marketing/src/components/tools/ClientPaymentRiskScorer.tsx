import { useMemo, useState } from 'react';

type Answers = {
  clientType: string;
  paymentHistory: string;
  contractStatus: string;
  projectSize: string;
  paymentTimeline: string;
  industryOfClient: string;
  geographyMatch: string;
  depositAlreadyPaid: string;
};

const QUESTIONS: { key: keyof Answers; label: string; options: { id: string; label: string; score: number }[] }[] = [
  { key: 'clientType', label: 'Q1. Client type', options: [{ id: 'b2c', label: 'Individual (B2C)', score: 15 }, { id: 'small', label: 'Small business <10 people', score: 5 }, { id: 'mid', label: 'Mid-size company 10–100 people', score: 8 }, { id: 'enterprise', label: 'Enterprise 100+ people', score: 10 }, { id: 'agency', label: 'Agency/reseller', score: 12 }] },
  { key: 'paymentHistory', label: 'Q2. Payment history', options: [{ id: 'new', label: 'New client, no history', score: 15 }, { id: 'ontime', label: 'Paid on time every time', score: -10 }, { id: 'late_some', label: 'Paid late once or twice', score: 20 }, { id: 'late_often', label: 'Regularly pays late', score: 35 }, { id: 'dispute', label: 'Has disputed an invoice before', score: 25 }] },
  { key: 'contractStatus', label: 'Q3. Contract status', options: [{ id: 'signed', label: 'Signed contract with payment terms', score: -10 }, { id: 'email_only', label: 'Verbal agreement or email only', score: 20 }, { id: 'po', label: 'Purchase order from procurement', score: -5 }, { id: 'none', label: 'No formal agreement', score: 30 }] },
  { key: 'projectSize', label: 'Q4. Project size', options: [{ id: 'u500', label: 'Under $500', score: 0 }, { id: '500-2000', label: '$500–$2,000', score: 5 }, { id: '2001-10000', label: '$2,001–$10,000', score: 10 }, { id: '10k', label: 'Over $10,000', score: 15 }] },
  { key: 'paymentTimeline', label: 'Q5. Payment timeline clarity', options: [{ id: 'specific', label: 'Already agreed specific pay date', score: -10 }, { id: 'vague', label: 'Vague "soon" or "end of month"', score: 15 }, { id: 'none', label: "Haven't discussed it", score: 25 }] },
  { key: 'industryOfClient', label: 'Q6. Client industry', options: [{ id: 'agency', label: 'Agency/Marketing', score: 8 }, { id: 'construction', label: 'Construction', score: 12 }, { id: 'retail', label: 'Retail/eCommerce', score: 5 }, { id: 'tech', label: 'Tech/SaaS', score: 3 }, { id: 'finance', label: 'Finance/Legal', score: 2 }, { id: 'gov', label: 'Government', score: 5 }, { id: 'health', label: 'Healthcare', score: 7 }, { id: 'events', label: 'Hospitality/Events', score: 15 }, { id: 'startup', label: 'Startup', score: 18 }, { id: 'other', label: 'Other', score: 8 }] },
  { key: 'geographyMatch', label: 'Q7. Geography and recourse', options: [{ id: 'same', label: 'Same country as me', score: 0 }, { id: 'diff_cur', label: 'Different country, common currency', score: 5 }, { id: 'intl', label: 'International, different currency', score: 10 }, { id: 'offshore', label: 'Offshore, limited recourse', score: 20 }] },
  { key: 'depositAlreadyPaid', label: 'Q8. Deposit status', options: [{ id: 'yes', label: 'Yes, deposit received', score: -20 }, { id: 'not_discussed', label: 'No deposit, not discussed', score: 10 }, { id: 'refused', label: 'No deposit, they refused', score: 30 }] },
];

export default function ClientPaymentRiskScorer() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Partial<Answers>>({});

  const scoreCard = useMemo(() => {
    const detailed = QUESTIONS.map((q) => {
      const choice = q.options.find((o) => o.id === answers[q.key]);
      return { key: q.key, label: q.label, value: choice?.label || 'Not answered', score: choice?.score || 0 };
    });
    const totalRisk = detailed.reduce((sum, row) => sum + row.score, 0);
    const riskLevel = totalRisk <= 20 ? 'Low Risk' : totalRisk <= 45 ? 'Moderate Risk' : totalRisk <= 75 ? 'High Risk' : 'Very High Risk';
    const riskColor: Record<string, string> = { 'Low Risk': 'text-emerald-600', 'Moderate Risk': 'text-amber-600', 'High Risk': 'text-orange-600', 'Very High Risk': 'text-red-600' };
    const depositRecommendation = totalRisk <= 20 ? '0–25% deposit' : totalRisk <= 45 ? '25–50% deposit' : totalRisk <= 75 ? '50% deposit required' : '50–100% upfront payment recommended';
    const termsRecommendation = totalRisk <= 20 ? 'Net 30 acceptable' : totalRisk <= 45 ? 'Net 14 recommended' : totalRisk <= 75 ? 'Net 7 or payment on delivery' : 'Payment before delivery or 100% upfront';

    const redFlags: string[] = [];
    if (answers.contractStatus === 'none') redFlags.push('No formal contract — highest single risk factor.');
    if (answers.paymentHistory === 'late_often' || answers.paymentHistory === 'late_some') redFlags.push('Client has paid late before — strong predictor of repeat behavior.');
    if (answers.depositAlreadyPaid === 'refused') redFlags.push('Deposit refused — weak commitment and higher non-payment risk.');
    if (answers.geographyMatch === 'offshore') redFlags.push('Offshore recourse is limited if payment stalls.');

    return { totalRisk, riskLevel, riskColor: riskColor[riskLevel], depositRecommendation, termsRecommendation, redFlags, detailed };
  }, [answers]);

  const q = QUESTIONS[step];
  const complete = Object.keys(answers).length === QUESTIONS.length;

  return (
    <div id="calculator" className="not-prose rounded-xl border border-border bg-muted/20 p-5">
      {!complete && (
        <div>
          <p className="text-xs text-muted-foreground">Step {step + 1} of {QUESTIONS.length}</p>
          <h3 className="mt-1 text-lg font-semibold">{q.label}</h3>
          <div className="mt-3 space-y-2">
            {q.options.map((opt) => (
              <label key={opt.id} className="flex cursor-pointer items-start gap-2 rounded-lg border border-border bg-background p-3 text-sm">
                <input type="radio" name={q.key} checked={answers[q.key] === opt.id} onChange={() => setAnswers((prev) => ({ ...prev, [q.key]: opt.id }))} />
                <span>{opt.label}</span>
              </label>
            ))}
          </div>
          <div className="mt-4 flex gap-2">
            <button type="button" className="rounded-lg border border-border px-4 py-2 text-sm" onClick={() => setStep((s) => Math.max(0, s - 1))}>Back</button>
            <button type="button" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground" disabled={!answers[q.key]} onClick={() => setStep((s) => Math.min(QUESTIONS.length - 1, s + 1))}>{step === QUESTIONS.length - 1 ? 'See results' : 'Next'}</button>
          </div>
        </div>
      )}

      {complete && (
        <div className="rounded-xl border border-border bg-background p-4">
          <p className="text-sm text-muted-foreground">CLIENT RISK ASSESSMENT</p>
          <p className={`text-2xl font-bold ${scoreCard.riskColor}`}>{scoreCard.riskLevel}</p>
          <p className="text-sm">Score: {scoreCard.totalRisk}/150</p>
          <div className="mt-4 space-y-1 text-sm">
            <p><strong>Deposit required:</strong> {scoreCard.depositRecommendation}</p>
            <p><strong>Payment terms:</strong> {scoreCard.termsRecommendation}</p>
            <p><strong>Contract:</strong> Written agreement essential</p>
            <p><strong>Payment method:</strong> Bank transfer or escrow (avoid payment on account)</p>
          </div>
          <div className="mt-4">
            <p className="text-sm font-semibold">⚠️ Red flags detected</p>
            {scoreCard.redFlags.length > 0 ? (
              <ul className="mt-2 list-disc pl-5 text-sm">{scoreCard.redFlags.map((f) => <li key={f}>{f}</li>)}</ul>
            ) : (
              <p className="text-sm text-muted-foreground">No major red flags from your answers.</p>
            )}
            <p className="mt-3 text-sm">💡 Get a signed contract with explicit payment terms before starting. Request the recommended deposit; if refused, reconsider project terms.</p>
          </div>
          <button type="button" onClick={() => { setAnswers({}); setStep(0); }} className="mt-4 rounded-lg border border-border px-4 py-2 text-sm">Start over</button>
        </div>
      )}
    </div>
  );
}
