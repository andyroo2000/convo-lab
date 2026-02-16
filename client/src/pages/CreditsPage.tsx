const CreditsPage = () => (
  <section className="card retro-paper-panel max-w-3xl">
    <div className="mb-5 rounded border-2 border-[#0f3561] bg-gradient-to-br from-[#f8f4e8] via-[#eee2c9] to-[#e1d0ac] px-4 py-6 text-[#17365d] shadow-[0_6px_0_rgba(17,51,92,0.18)] sm:px-5">
      <p className="pb-2 text-[clamp(1.1rem,0.9rem+1vw,1.5rem)] font-semibold leading-[1.1] tracking-[0.04em] text-[#325984]">
        Credits
      </p>
      <h1 className="retro-headline text-[clamp(1.3rem,1rem+1.4vw,2rem)] leading-[1.1] text-[#17365d]">
        Icon Credits And Licenses
      </h1>
      <p className="mt-2 text-sm font-semibold leading-tight text-[#395d86] sm:text-base">
        This page lists third-party source assets used for tool illustrations.
      </p>
    </div>

    <div className="space-y-4 text-sm sm:text-base">
      <div>
        <h2 className="text-lg font-bold text-[#17365d]">Current Entries</h2>
        <ul className="mt-2 list-disc space-y-2 pl-5 text-[#274a73]">
          <li>
            Banana illustration reference licensed from{' '}
            <a
              href="https://www.dreamstime.com/cartoon-banana-icon-isolated-white-background-vector-image145039913"
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-[#17365d] underline decoration-[#17365d]/40 underline-offset-2 hover:text-[#0f3561]"
            >
              Dreamstime image 145039913
            </a>
            .
          </li>
          <li>
            &quot;paper sheet&quot; icon by Tinashe Mugayi from{' '}
            <a
              href="https://thenounproject.com/icon/paper-sheet-738319/"
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-[#17365d] underline decoration-[#17365d]/40 underline-offset-2 hover:text-[#0f3561]"
            >
              Noun Project
            </a>{' '}
            (used with attribution).
          </li>
        </ul>
      </div>

      <p className="text-sm text-[#345b86]">
        Additional icon attributions will be added here as new licensed or attribution-required
        assets are introduced.
      </p>
    </div>
  </section>
);

export default CreditsPage;
