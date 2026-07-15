import PlannerForm from "../components/PlannerForm";

export default function Home() {
  return (
    <main className="min-h-screen bg-base-200">
      <section className="px-6 py-16">
        <div className="mx-auto flex max-w-5xl flex-col gap-10">
          <div className="max-w-3xl">
            <div className="badge badge-primary badge-outline mb-6">
              Minimal plan
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-base-content md:text-6xl">
              Running Fueling Calculator
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-base-content/75">
              Enter your Run distance and pace to see the derived Run Duration
              and the Carb Target for your Fueling Plan.
            </p>
          </div>

          <PlannerForm />
        </div>
      </section>
    </main>
  );
}
