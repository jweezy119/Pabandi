import { useQuery, useMutation, useQueryClient } from 'react-query';
import { sourcingService } from '../services/api';
import { ShoppingCartIcon, ArrowUpRightIcon, SparklesIcon, CheckCircleIcon, ClockIcon } from '@heroicons/react/24/outline';

interface AccioDemandSourcingWidgetProps {
  businessId: string;
}

export default function AccioDemandSourcingWidget({ businessId }: AccioDemandSourcingWidgetProps) {
  const qc = useQueryClient();

  const { data: sourcingData, isLoading } = useQuery(
    ['sourcing-demand', businessId],
    async () => {
      const res = await sourcingService.analyzeDemand();
      return res.data;
    },
    { enabled: !!businessId }
  );

  const confirmMutation = useMutation(
    (orderId: string) => sourcingService.confirmOrder(orderId),
    {
      onSuccess: () => {
        qc.invalidateQueries(['sourcing-demand', businessId]);
      },
    }
  );

  if (isLoading) {
    return (
      <div className="p-6 text-center text-sm text-on-surface-variant bg-surface-container-lowest rounded-2xl border border-outline-variant/30 animate-pulse">
        Analyzing upcoming reservation demand and supply chain requirements...
      </div>
    );
  }

  const analysis = sourcingData?.analysis;
  const draftOrder = sourcingData?.draftOrder;
  const pastOrders = sourcingData?.pastOrders || [];

  const needs = analysis?.needs || [];
  const predictedGuests = analysis?.totalGuestsPredicted || 0;

  if (needs.length === 0 && pastOrders.length === 0) {
    return (
      <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-headline text-lg font-bold text-on-surface">Accio Wholesale Supply Planner</h3>
          <span className="flex items-center gap-1 font-label text-[9px] font-bold px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant uppercase tracking-wider">
            Powered by Accio
          </span>
        </div>
        <p className="text-sm text-on-surface-variant leading-relaxed">
          No high-volume reservations predicted for the next 7 days. Your inventory is sufficient for the forecasted visitor volume.
        </p>
      </div>
    );
  }

  const handleConfirmOrder = () => {
    if (!draftOrder?.id) return;
    if (confirm('Confirm order placement via Alibaba Accio Sourcing Agent? The payment will be settled automatically via Pabandi Treasury.')) {
      confirmMutation.mutate(draftOrder.id);
    }
  };

  return (
    <div 
      className="rounded-2xl p-6 mb-8 overflow-hidden transition-all duration-300"
      style={{
        background: 'linear-gradient(135deg, rgba(255, 106, 0, 0.08) 0%, var(--color-surface-raised) 45%, rgba(255, 18, 0, 0.06) 100%)',
        border: '1px solid rgba(255, 106, 0, 0.25)',
      }}
    >
      {/* Widget Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <span 
            className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full shadow-sm"
            style={{ background: 'rgba(255, 106, 0, 0.15)', color: '#FF6A00' }}
          >
            Alibaba Accio · Demand Planner
          </span>
          <h2 className="text-xl font-black text-on-surface mt-2 flex items-center gap-2">
            <ShoppingCartIcon className="h-6 w-6 text-[#FF6A00]" />
            Wholesale Inventory Sourcing Agent
          </h2>
          <p className="text-xs text-on-surface-variant mt-1">
            Predictive supplier ordering based on reservations for the next 7 days ({predictedGuests} guests forecasted).
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left/Middle Column: Supply Needs and Orders */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Needs List */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-3">Predicted Supply Deficit</h3>
            <div className="space-y-2">
              {needs.map((item: any, idx: number) => (
                <div 
                  key={idx} 
                  className="flex items-center justify-between p-3.5 bg-surface-container-lowest border border-outline-variant/30 rounded-xl hover:border-[#FF6A00]/30 transition-all hover:shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#FF6A00]/10 flex items-center justify-center font-bold text-sm text-[#FF6A00]">
                      {item.quantity}x
                    </div>
                    <div>
                      <p className="font-body text-sm font-bold text-on-surface">{item.itemName}</p>
                      <p className="font-body text-[11px] text-on-surface-variant">Est. PKR {item.estimatedPricePKR.toLocaleString()} each</p>
                    </div>
                  </div>
                  <a 
                    href={item.accioUrl} 
                    target="_blank" 
                    rel="noreferrer" 
                    className="flex items-center gap-1 font-body text-xs font-bold text-[#FF6A00] hover:underline"
                  >
                    View <ArrowUpRightIcon className="h-3 w-3" />
                  </a>
                </div>
              ))}
            </div>
          </div>

          {/* Stepper Tracking for Active Draft/Ordered Sourcing */}
          {draftOrder && (
            <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4 className="text-sm font-bold text-on-surface">Active Accio Order</h4>
                  <p className="text-[10px] text-on-surface-variant font-medium mt-0.5">
                    {draftOrder.status === 'SUGGESTED' 
                      ? 'Draft order ready for execution' 
                      : `Tracking ID: ${draftOrder.accioWorkOrderId || 'Processing...'}`
                    }
                  </p>
                </div>
                <span className="font-headline text-sm font-bold text-[#FF6A00]">
                  PKR {draftOrder.estimatedCostPKR.toLocaleString()}
                </span>
              </div>

              {/* Stepper Visualization */}
              <div className="flex items-center justify-between relative mt-2 mb-4 px-2">
                {/* Connector Line */}
                <div className="absolute left-0 right-0 top-3 h-1 bg-surface-container-high -z-10" />
                <div 
                  className="absolute left-0 top-3 h-1 bg-[#FF6A00] -z-10 transition-all duration-500" 
                  style={{
                    width: draftOrder.status === 'SUGGESTED' ? '15%' : '100%'
                  }}
                />

                {/* Steps */}
                <Step 
                  label="1. Forecast" 
                  active={true} 
                  completed={true} 
                />
                <Step 
                  label="2. Sourced" 
                  active={draftOrder.status !== 'SUGGESTED'} 
                  completed={draftOrder.status !== 'SUGGESTED'} 
                />
                <Step 
                  label="3. Shipped" 
                  active={draftOrder.status !== 'SUGGESTED'} 
                  completed={draftOrder.status !== 'SUGGESTED'} 
                  isEstimate
                />
                <Step 
                  label="4. Arrived" 
                  active={false} 
                  completed={false} 
                />
              </div>

              {draftOrder.status === 'SUGGESTED' ? (
                <button
                  onClick={handleConfirmOrder}
                  disabled={confirmMutation.isLoading}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-[#FF6A00] to-[#FF1200] text-white font-body font-bold text-sm hover:opacity-90 transition-opacity shadow-md disabled:opacity-50"
                >
                  <SparklesIcon className="h-4.5 w-4.5 animate-pulse" />
                  {confirmMutation.isLoading ? 'Routing Sourcing Order...' : '1-Click Auto-Source via Accio'}
                </button>
              ) : (
                <div className="p-3 bg-[#059669]/10 border border-[#059669]/30 rounded-lg flex items-center gap-2 text-[#059669] text-xs font-bold">
                  <CheckCircleIcon className="h-4 w-4 shrink-0" />
                  Order Placed successfully! Sourced via Alibaba Accio Agent and en route to merchant location.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Order History */}
        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-4">Past Sourcing Runs</h3>
          
          {pastOrders.length === 0 ? (
            <div className="text-center py-10 text-on-surface-variant text-xs">
              <ClockIcon className="h-8 w-8 mx-auto opacity-30 mb-2" />
              No completed sourcing runs yet.
            </div>
          ) : (
            <div className="space-y-3.5 max-h-[300px] overflow-y-auto pr-1">
              {pastOrders.map((order: any) => (
                <div 
                  key={order.id} 
                  className="pb-3.5 border-b border-outline-variant/20 last:border-0 last:pb-0"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-headline text-xs font-bold text-on-surface truncate max-w-[120px]">
                      {order.accioWorkOrderId || `Order #${order.id.substring(0, 6)}`}
                    </span>
                    <span className="font-label text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 uppercase tracking-wider">
                      {order.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-on-surface-variant">
                    <span>
                      {new Date(order.createdAt).toLocaleDateString()}
                    </span>
                    <span className="font-bold text-on-surface">
                      PKR {order.estimatedCostPKR.toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface StepProps {
  label: string;
  active: boolean;
  completed: boolean;
  isEstimate?: boolean;
}

function Step({ label, active, completed, isEstimate }: StepProps) {
  return (
    <div className="flex flex-col items-center z-10">
      <div 
        className={`w-6.5 h-6.5 rounded-full flex items-center justify-center text-[10px] font-bold border-2 transition-all duration-300 ${
          completed 
            ? 'bg-[#FF6A00] border-[#FF6A00] text-white' 
            : active 
              ? 'bg-white border-[#FF6A00] text-[#FF6A00] shadow-sm animate-pulse' 
              : 'bg-white border-surface-container-high text-on-surface-variant'
        }`}
      >
        {completed ? '✓' : isEstimate ? '⛟' : '○'}
      </div>
      <span className="font-label text-[9px] font-bold text-on-surface-variant mt-1.5 uppercase tracking-wide">
        {label}
      </span>
    </div>
  );
}
