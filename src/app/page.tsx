const features = [
  "Estimate Run Duration from distance and pace",
  "Size Carb Target by duration band",
  "Balance Fuel Sources with Homemade Sports Drink first",
];

export default function Home() {
  return (
    <main className="min-h-screen bg-base-200">
      <section className="hero min-h-screen px-6 py-16">
        <div className="hero-content max-w-5xl flex-col gap-10 text-center">
          <div className="max-w-3xl">
            <div className="badge badge-primary badge-outline mb-6">
              Static walking skeleton
            </div>
            <h1 className="text-5xl font-bold tracking-tight text-base-content md:text-7xl">
              Running Fueling Calculator
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-base-content/75">
              Build a Fueling Plan for a Run from your Run Duration, preferred
              Fuel Sources, Carb Target, Fluid Target, Sweat Rate, and
              Conditions.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <button className="btn btn-primary" type="button">
                Calculator coming soon
              </button>
              <a
                className="btn btn-ghost"
                href="https://github.com/pbexe/run-fueling-calculator"
              >
                View source
              </a>
            </div>
          </div>

          <div className="grid w-full gap-4 md:grid-cols-3">
            {features.map((feature, index) => (
              <article key={feature} className="card bg-base-100 shadow-xl">
                <div className="card-body items-center text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-xl font-bold text-primary-content">
                    {index + 1}
                  </div>
                  <h2 className="card-title text-lg">{feature}</h2>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
