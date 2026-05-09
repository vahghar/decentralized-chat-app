import { Github, Lock, MessageSquare, Shield, Twitter, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';

function LandingPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Hero Section */}
      <div className="relative isolate pt-24 flex-grow">
        <div className="absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl" aria-hidden="true">
          <div className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-primary to-[#9089fc] opacity-30 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]"></div>
        </div>
        
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
              Secure Conversations<span className="text-primary"> Mostly</span>
            </h1>
            <p className="mt-6 text-lg leading-8 text-muted-foreground">
              Another chat app, now with slightly more encryption. Send messages and memes fully encrypted, fully useless, and fully yours.
            </p>
            <div className="mt-10 flex items-center justify-center gap-x-6">
              <Link to="/signup" className="rounded-md bg-primary px-3.5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:opacity-90 transition-all">
                Get Started
              </Link>
              <Link to="/login" className="text-sm font-semibold leading-6">
                Sign In <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>

          {/* Feature Section */}
          <div className="mx-auto mt-32 max-w-7xl sm:mt-40">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Everything you need for secure communication</h2>
              <p className="mt-6 text-lg leading-8 text-muted-foreground">
                Encrypted, slightly glitchy, and probably not life-changing 
              </p>
            </div>

            <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-none">
              <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-16 lg:max-w-none lg:grid-cols-3">
                <div className="flex flex-col">
                  <dt className="flex items-center gap-x-3 text-lg font-semibold leading-7">
                    <Shield className="size-5 text-primary flex-none" aria-hidden="true" />
                    End-to-End Encryption
                  </dt>
                  <dd className="mt-4 flex flex-auto flex-col text-base leading-7 text-muted-foreground">
                    <p className="flex-auto">Your messages are scrambled so well, not even we can read them. Seriously.</p>
                  </dd>
                </div>
                <div className="flex flex-col">
                  <dt className="flex items-center gap-x-3 text-lg font-semibold leading-7">
                    <Zap className="size-5 text-primary flex-none" aria-hidden="true" />
                    Real-Time Messaging
                  </dt>
                  <dd className="mt-4 flex flex-auto flex-col text-base leading-7 text-muted-foreground">
                    <p className="flex-auto">Instant-ish messages, with typing indicators and read receipts. We promise it’s faster than a carrier pigeon.</p>
                  </dd>
                </div>
                <div className="flex flex-col">
                  <dt className="flex items-center gap-x-3 text-lg font-semibold leading-7">
                    <Lock className="size-5 text-primary flex-none" aria-hidden="true" />
                    Privacy First
                  </dt>
                  <dd className="mt-4 flex flex-auto flex-col text-base leading-7 text-muted-foreground">
                    <p className="flex-auto">Your data belongs to you. We can’t read your messages, and honestly, we probably don’t want to.</p>
                  </dd>
                </div>
              </dl>
            </div>
          </div>

          {/* Stats Section 
          <div className="mx-auto mt-32 max-w-7xl sm:mt-40">
            <div className="grid grid-cols-1 gap-x-8 gap-y-16 text-center lg:grid-cols-3">
              <div className="mx-auto flex max-w-xs flex-col gap-y-4">
                <dt className="text-base leading-7 text-muted-foreground">Messages sent securely</dt>
                <dd className="order-first text-3xl font-semibold tracking-tight">100M+</dd>
              </div>
              <div className="mx-auto flex max-w-xs flex-col gap-y-4">
                <dt className="text-base leading-7 text-muted-foreground">Active users</dt>
                <dd className="order-first text-3xl font-semibold tracking-tight">500K+</dd>
              </div>
              <div className="mx-auto flex max-w-xs flex-col gap-y-4">
                <dt className="text-base leading-7 text-muted-foreground">Countries supported</dt>
                <dd className="order-first text-3xl font-semibold tracking-tight">150+</dd>
              </div>
            </div>
          </div>*/}
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-32 border-t border-gray-900/10 dark:border-gray-100/10">
        <div className="mx-auto max-w-7xl px-6 py-12 md:flex md:items-center md:justify-between lg:px-8">
          <div className="flex justify-center space-x-6 md:order-2">
            <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-primary">
              <MessageSquare className="size-5" />
              <span className="font-semibold">Convo</span>
            </Link>
            <a href="https://github.com/vahghar/realtime-chat-app" className="text-muted-foreground hover:text-primary" target="_blank" rel="noopener noreferrer">
              <span className="sr-only">GitHub</span>
              <Github className="size-5" />
            </a>
          </div>
          <div className="mt-8 md:order-1 md:mt-0">
            <p className="text-center text-sm leading-5 text-muted-foreground">
              &copy; {new Date().getFullYear()} Convo. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default LandingPage;