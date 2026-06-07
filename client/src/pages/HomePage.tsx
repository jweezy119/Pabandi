import { Link } from 'react-router-dom';

export default function HomePage() {
  return (
    <div className="max-w-5xl mx-auto px-6 md:px-8 space-y-12 mt-4 pb-28 md:pb-10">
      
      {/* Hero & Search Section */}
      <section className="space-y-6">
        <div className="max-w-xl">
          <h2 className="font-headline text-[2.75rem] leading-[1.1] font-bold text-on-surface tracking-[-0.02em] mb-2">
            Precision discovery.
          </h2>
          <p className="font-body text-on-surface-variant text-base">
            Explore Karachi's finest corporate spaces, high-end salons, and wellness retreats.
          </p>
        </div>
        
        {/* Search Bar */}
        <div className="bg-surface-container-low rounded-lg flex items-center px-4 py-3 group focus-within:bg-surface-container-lowest focus-within:outline focus-within:outline-1 focus-within:outline-outline-variant/20 transition-all duration-300">
          <span className="material-symbols-outlined text-outline mr-3">search</span>
          <input 
            className="bg-transparent border-none focus:ring-0 w-full font-body text-sm text-on-surface placeholder-outline font-medium focus:outline-none" 
            placeholder="Find places, categories, or services..." 
            type="text"
          />
          <button className="bg-gradient-to-r from-primary to-primary-container text-on-primary px-4 py-1.5 rounded text-sm font-body font-medium ml-2 shadow-[0_4px_12px_rgba(1,29,53,0.15)]">
            Search
          </button>
        </div>
        
        {/* Category Filters */}
        <div className="flex overflow-x-auto gap-3 no-scrollbar pb-2" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          <button className="bg-primary text-on-primary px-5 py-2.5 rounded-lg font-label text-sm font-medium whitespace-nowrap shadow-[0_8px_16px_rgba(1,29,53,0.08)]">All Categories</button>
          <button className="bg-surface-container-low text-on-surface px-5 py-2.5 rounded-lg font-label text-sm font-medium whitespace-nowrap hover:bg-surface-container-highest transition-colors">Fine Dining</button>
          <button className="bg-surface-container-low text-on-surface px-5 py-2.5 rounded-lg font-label text-sm font-medium whitespace-nowrap hover:bg-surface-container-highest transition-colors">Wellness</button>
          <button className="bg-surface-container-low text-on-surface px-5 py-2.5 rounded-lg font-label text-sm font-medium whitespace-nowrap hover:bg-surface-container-highest transition-colors">Corporate</button>
          <button className="bg-surface-container-low text-on-surface px-5 py-2.5 rounded-lg font-label text-sm font-medium whitespace-nowrap hover:bg-surface-container-highest transition-colors">Salons</button>
        </div>
      </section>

      {/* Curated for You (Bento Grid) */}
      <section className="space-y-6">
        <div className="flex justify-between items-end">
          <h3 className="font-headline text-2xl font-bold tracking-tight text-on-surface">Curated for You</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          
          {/* Large Feature Card */}
          <Link to="/business/1" className="md:col-span-8 bg-surface-container-lowest rounded-xl overflow-hidden shadow-[0_20px_40px_rgba(1,29,53,0.06)] group relative h-80 block">
            <img alt="Interior of Kolachi" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCBNDdUXhDwbCOZti_gVtWsFUYaFVdUTO2rRgBTNIRjOka9f8wgabig1yQzO-yO4Z7ORMUMhRu5Zk_AKI-V_qd_8syjD4LNxxt3G0WEDrCuFEohLBPnZzi8CvMKzMUcMnUt0jmD_KIBU-zyvJGALiDOkOf3RhA8EnY1Q1URUUJNojFdN0d-nGL0zflUQPHvVsLseM3p1N8Obfxz22LwWQXpUkQ4z16T4DELfbjBuQW_6-IKDA_bfrOymwag5-FKDkE_4mYaBJiFTd7b" />
            <div className="absolute inset-0 bg-gradient-to-t from-primary/90 via-primary/40 to-transparent"></div>
            <div className="absolute bottom-0 left-0 p-6 w-full">
              <div className="flex items-center gap-2 mb-2">
                <span className="bg-tertiary-fixed text-on-tertiary-fixed-variant px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">Fine Dining</span>
                <span className="flex items-center text-on-primary text-sm font-body"><span className="material-symbols-outlined text-[16px] mr-1" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>4.9</span>
              </div>
              <h4 className="font-headline text-2xl font-bold text-on-primary mb-1">Kolachi Signature</h4>
              <p className="font-body text-primary-fixed-dim text-sm max-w-md">Experience culinary excellence by the Arabian Sea. Exclusive corporate booking slots available.</p>
            </div>
          </Link>
          
          {/* Secondary Cards Stack */}
          <div className="md:col-span-4 flex flex-col gap-6">
            {/* Small Card 1 */}
            <Link to="/business/2" className="bg-surface-container-lowest rounded-xl overflow-hidden shadow-[0_20px_40px_rgba(1,29,53,0.06)] flex-1 relative group block min-h-[150px]">
              <img alt="Corporate Boardroom" className="w-full h-full object-cover absolute inset-0 transition-transform duration-700 group-hover:scale-105" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBOD0t1Cdj8w4hsh8xa0SsNNVWzBPs8S7OzZFqa1yx1CEbetRl37A3xdwP1NlEN4Mdk5y_5VmKZZMlY18goW8xX4KaosxLcWEQx9uX6zN-i63R6OUIbIBtEcD3YUskznYbJQrrb__OXf-wbVH2YMfU324n5zrHNjIeoeNQGDKw2U37MO2HW0E2yuFaPJoL4J2-HeHGEy7_blOQxEeIi-erIqnb0dbQVbCpDTlL3ZPEwxt6U1bi7O2KDdMZek9MgOhqxu4a3Dd2Vh4Ex" />
              <div className="absolute inset-0 bg-gradient-to-t from-primary/80 to-transparent"></div>
              <div className="absolute bottom-0 left-0 p-5">
                <span className="bg-secondary-container text-on-secondary-fixed-variant px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider mb-2 inline-block">Corporate</span>
                <h4 className="font-headline text-lg font-bold text-on-primary">The Hive Connect</h4>
              </div>
            </Link>
            {/* Small Card 2 */}
            <div className="bg-surface-container-low rounded-xl overflow-hidden flex-1 p-5 flex flex-col justify-center min-h-[150px] cursor-pointer group hover:bg-surface-container transition-colors">
              <h4 className="font-headline text-lg font-bold text-on-surface mb-2">Upcoming in DHA</h4>
              <p className="font-body text-on-surface-variant text-sm mb-4">Discover newly registered wellness centers with early-bird access.</p>
              <button className="flex items-center text-primary font-body text-sm font-semibold group-hover:gap-2 transition-all">Explore <span className="material-symbols-outlined text-[18px] ml-1">arrow_forward</span></button>
            </div>
          </div>

        </div>
      </section>

      {/* Top Rated (Asymmetric List) */}
      <section className="space-y-6">
        <h3 className="font-headline text-2xl font-bold tracking-tight text-on-surface">Top Rated Institutions</h3>
        <div className="space-y-4">
          
          {/* List Item 1 */}
          <Link to="/business/3" className="bg-surface-container-lowest rounded-xl p-4 flex items-center gap-6 shadow-[0_10px_20px_rgba(1,29,53,0.03)] group block hover:bg-surface-container-lowest/80 transition-colors">
            <div className="w-24 h-24 rounded-lg overflow-hidden shrink-0 bg-surface-container-highest">
              <img alt="Spa Interior" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBaUhimKKm58BFGLM9vGKNloRQmOtJ_oZ1vQTzq4tEMpR0tkUlwSfDVxiJ3ni_HquN9mHOhbdDFM3jSbHolrGh6MNKsvV2TWr5X0woy89YSFTxHUoCmvHumNJZHCDFM4Ctunysj4gNMj8L88Z5GGCK93pJ56TNfpXSgfGhsy_d2Mi8B5MTaW5SKowLJni-ziTcqkiZPkeZJrNikVrWv93E4T_h72457sjI8dx1DqwwHt5OvDPc5nok12vc4OblEksJC5uN4M4D9WE1n" />
            </div>
            <div className="flex-1">
              <div className="flex justify-between items-start mb-1">
                <h4 className="font-headline text-lg font-bold text-on-surface">Nirvana Wellness Spa</h4>
                <span className="flex items-center text-on-surface font-body font-semibold text-sm bg-surface-container px-2 py-1 rounded">
                  <span className="material-symbols-outlined text-[16px] text-[#f59e0b] mr-1" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>4.8
                </span>
              </div>
              <p className="font-body text-on-surface-variant text-sm mb-3">Clifton Block 4 • Holistic therapies & corporate decompression packages.</p>
              <div className="flex gap-2">
                <span className="font-label text-xs text-on-surface-variant bg-surface-container-low px-2 py-1 rounded">Wellness</span>
                <span className="font-label text-xs text-on-surface-variant bg-surface-container-low px-2 py-1 rounded">$$$</span>
              </div>
            </div>
          </Link>

          {/* List Item 2 */}
          <Link to="/business/4" className="bg-surface-container-lowest rounded-xl p-4 flex items-center gap-6 shadow-[0_10px_20px_rgba(1,29,53,0.03)] group block hover:bg-surface-container-lowest/80 transition-colors">
            <div className="w-24 h-24 rounded-lg overflow-hidden shrink-0 bg-surface-container-highest">
              <img alt="Salon Interior" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAgA8k04K_B3yFvj6vGj40DIFlW-XhTq0K87_u6YQJ7Y1l6iT5mIu6z-1s1W5gA8T5K1J4F_4i1vD6bF3VqD9j60Ym15O2hW4X2zF5tXy6k8l3I_E1L8q0n5D1cM8y6xJ3T_9P-Kz8wV1D2l1i8O6s3mI8L1jQ7o3rG9l4N5B6X8T2mH3l9e1gM0D9x2oF9H4s6Z0W3X6tJ_E8c7Q5mR8X4vT9c6u3Z1M8q0vT7dF9J0bY3tW6e9V2c1H7w" />
            </div>
            <div className="flex-1">
              <div className="flex justify-between items-start mb-1">
                <h4 className="font-headline text-lg font-bold text-on-surface">Toni & Guy Signature</h4>
                <span className="flex items-center text-on-surface font-body font-semibold text-sm bg-surface-container px-2 py-1 rounded">
                  <span className="material-symbols-outlined text-[16px] text-[#f59e0b] mr-1" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>4.7
                </span>
              </div>
              <p className="font-body text-on-surface-variant text-sm mb-3">DHA Phase 6 • Premium styling, color correction, and bridal services.</p>
              <div className="flex gap-2">
                <span className="font-label text-xs text-on-surface-variant bg-surface-container-low px-2 py-1 rounded">Salons</span>
                <span className="font-label text-xs text-on-surface-variant bg-surface-container-low px-2 py-1 rounded">$$</span>
              </div>
            </div>
          </Link>
          
        </div>
      </section>

    </div>
  );
}
