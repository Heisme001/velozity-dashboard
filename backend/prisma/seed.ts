import { PrismaClient, Role, TaskStatus, Priority } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding Velozity Dashboard with realistic enterprise dataset...');

  // Clean slate
  await prisma.notification.deleteMany();
  await prisma.activity.deleteMany();
  await prisma.task.deleteMany();
  await prisma.project.deleteMany();
  await prisma.client.deleteMany();
  await prisma.user.deleteMany();

  const hashedPassword = await bcrypt.hash('Password@123', 10);

  // ── Users: 1 Admin, 2 PMs, 4 Devs ──────────────────────────────────────────
  const admin = await prisma.user.create({
    data: {
      name: 'Hemanth Kumar (VP Engineering)',
      email: 'admin@velozity.com',
      password: hashedPassword,
      role: Role.ADMIN
    }
  });

  const pm1 = await prisma.user.create({
    data: {
      name: 'Ravi Teja (Principal PM)',
      email: 'ravi.pm@velozity.com',
      password: hashedPassword,
      role: Role.PROJECT_MANAGER
    }
  });

  const pm2 = await prisma.user.create({
    data: {
      name: 'Ananya Iyer (Technical PM)',
      email: 'ananya.pm@velozity.com',
      password: hashedPassword,
      role: Role.PROJECT_MANAGER
    }
  });

  const dev1 = await prisma.user.create({
    data: {
      name: 'Priya Sharma (Sr. Backend)',
      email: 'priya.dev@velozity.com',
      password: hashedPassword,
      role: Role.DEVELOPER
    }
  });

  const dev2 = await prisma.user.create({
    data: {
      name: 'Siddharth Verma (Full Stack)',
      email: 'siddharth.dev@velozity.com',
      password: hashedPassword,
      role: Role.DEVELOPER
    }
  });

  const dev3 = await prisma.user.create({
    data: {
      name: 'Marcus Vance (Distributed Systems)',
      email: 'marcus.dev@velozity.com',
      password: hashedPassword,
      role: Role.DEVELOPER
    }
  });

  const dev4 = await prisma.user.create({
    data: {
      name: 'Kavya Nair (DevOps & Data)',
      email: 'kavya.dev@velozity.com',
      password: hashedPassword,
      role: Role.DEVELOPER
    }
  });

  console.log('✅ Created 7 engineering users (1 Admin, 2 PMs, 4 Developers)');

  // ── Clients ──────────────────────────────────────────────────────────────────
  const client1 = await prisma.client.create({
    data: {
      name: 'Vikram Mehta',
      email: 'tech-partners@zomato-logistics.in',
      company: 'Zomato Hyperlocal Logistics'
    }
  });
  const client2 = await prisma.client.create({
    data: {
      name: 'Aditi Deshmukh',
      email: 'fintech-core@hdfc-sec.com',
      company: 'HDFC Securities Digital'
    }
  });
  const client3 = await prisma.client.create({
    data: {
      name: 'Dr. Arjun Sengupta',
      email: 'integrations@1mg-health.in',
      company: 'Tata 1mg Digital Health'
    }
  });

  console.log('✅ Created 3 enterprise clients');

  // ── Projects ─────────────────────────────────────────────────────────────────
  const project1 = await prisma.project.create({
    data: {
      title: 'Hyperlocal Courier Geo-Routing Engine',
      description:
        'Microsecond ETA recalculation and batch assignment using PostGIS and Redis geospatial streams.',
      clientId: client1.id,
      pmId: pm1.id
    }
  });

  const project2 = await prisma.project.create({
    data: {
      title: 'High-Frequency Order Settlement Gateway',
      description:
        'Zero-downtime ledger matching, Razorpay/UPI webhook idempotency locks, and automated reconciliations.',
      clientId: client2.id,
      pmId: pm1.id
    }
  });

  const project3 = await prisma.project.create({
    data: {
      title: 'Clinical Tele-Consult & EHR Pipeline',
      description:
        'End-to-end encrypted WebRTC medical consults, prescription OCR parsing, and HL7 FHIR sync.',
      clientId: client3.id,
      pmId: pm2.id
    }
  });

  console.log('✅ Created 3 projects (pm1 owns projects 1 & 2, pm2 owns project 3)');

  // ── Date helpers ──────────────────────────────────────────────────────────────
  const now = new Date();
  const pastDate1 = new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000); // 4 days ago
  const pastDate2 = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000); // yesterday (overdue)
  const futureDate1 = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000); // in 2 days
  const futureDate2 = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000); // in 5 days
  const futureDate3 = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000); // in 10 days

  // ── Task factory ──────────────────────────────────────────────────────────────
  async function seedTask(params: {
    title: string;
    description: string;
    status: TaskStatus;
    priority: Priority;
    dueDate: Date;
    isOverdue?: boolean;
    projectId: string;
    developerId: string;
    creator: typeof pm1;
  }) {
    const isOverdue =
      params.isOverdue !== undefined
        ? params.isOverdue
        : params.dueDate < now && params.status !== TaskStatus.DONE;

    const task = await prisma.task.create({
      data: {
        title: params.title,
        description: params.description,
        status: params.status,
        priority: params.priority,
        dueDate: params.dueDate,
        isOverdue,
        projectId: params.projectId,
        developerId: params.developerId
      }
    });

    // Pre-seeded activity log entry so the feed is never empty on first load
    await prisma.activity.create({
      data: {
        action: 'TASK_CREATED',
        description: `${params.creator.name} created Task #${task.id}: "${task.title}"`,
        newStatus: params.status,
        taskId: task.id,
        projectId: params.projectId,
        userId: params.creator.id,
        createdAt: new Date(Date.now() - Math.floor(Math.random() * 8_000_000))
      }
    });

    return task;
  }

  // ── Project 1 Tasks (5 tasks, 1 overdue) ─────────────────────────────────────
  const t1 = await seedTask({
    title: 'PostGIS QuadTree spatial index partitioning',
    description:
      'Partition polygon geo-tables by city tier to reduce 99th percentile query latency under 12ms.',
    status: TaskStatus.DONE,
    priority: Priority.HIGH,
    dueDate: pastDate1,
    projectId: project1.id,
    developerId: dev1.id,
    creator: pm1
  });

  const t2 = await seedTask({
    title: 'Kafka rider dispatch consumer lag backpressure',
    description:
      'Tune prefetch buffer and auto-commit offsets to avoid consumer rebalances during peak 8 PM dinner rushes.',
    status: TaskStatus.IN_PROGRESS,
    priority: Priority.CRITICAL,
    dueDate: futureDate1,
    projectId: project1.id,
    developerId: dev1.id,
    creator: pm1
  });

  const t3 = await seedTask({
    title: 'Real-time WebSocket telemetry for delivery fleets',
    description:
      'Compress binary lat/long payloads with Protocol Buffers over Socket.io connections.',
    status: TaskStatus.IN_REVIEW,
    priority: Priority.HIGH,
    dueDate: futureDate2,
    projectId: project1.id,
    developerId: dev2.id,
    creator: pm1
  });

  const t4 = await seedTask({
    title: 'Battery drain telemetry profiling on rider Android app',
    description: 'Benchmark GPS polling intervals between active navigation vs idle waiting states.',
    status: TaskStatus.TODO,
    priority: Priority.MEDIUM,
    dueDate: pastDate2, // OVERDUE
    isOverdue: true,
    projectId: project1.id,
    developerId: dev2.id,
    creator: pm1
  });

  const t5 = await seedTask({
    title: 'Dynamic surge multiplier rule engine in Redis',
    description: 'Compute demand-to-supply density ratio per H3 hexagonal cell every 30 seconds.',
    status: TaskStatus.TODO,
    priority: Priority.LOW,
    dueDate: futureDate3,
    projectId: project1.id,
    developerId: dev4.id,
    creator: pm1
  });

  // ── Project 2 Tasks (5 tasks, 2 overdue) ─────────────────────────────────────
  const t6 = await seedTask({
    title: 'UPI 2.0 Webhook callback idempotency ledger',
    description:
      'Implement distributed Redis lock on bank transaction reference IDs to eliminate duplicate credit entries.',
    status: TaskStatus.DONE,
    priority: Priority.CRITICAL,
    dueDate: pastDate1,
    projectId: project2.id,
    developerId: dev1.id,
    creator: pm1
  });

  const t7 = await seedTask({
    title: 'SEBI compliance audit logging & immutability',
    description:
      'Hash chain order modification audits with SHA-256 before writing to cold S3 Glacier storage.',
    status: TaskStatus.IN_PROGRESS,
    priority: Priority.CRITICAL,
    dueDate: pastDate1, // OVERDUE
    isOverdue: true,
    projectId: project2.id,
    developerId: dev3.id,
    creator: pm1
  });

  const t8 = await seedTask({
    title: 'Multi-bank payout failover circuit breaker',
    description:
      'Auto-reroute NEFT/RTGS payouts to alternate banking partners when API error rate exceeds 2.5%.',
    status: TaskStatus.IN_REVIEW,
    priority: Priority.HIGH,
    dueDate: futureDate1,
    projectId: project2.id,
    developerId: dev3.id,
    creator: pm1
  });

  const t9 = await seedTask({
    title: 'Automated GST TDS invoice certificate generator',
    description:
      'Produce digitally signed form 16A PDF certificates via headless Chromium microservice.',
    status: TaskStatus.TODO,
    priority: Priority.MEDIUM,
    dueDate: futureDate2,
    projectId: project2.id,
    developerId: dev4.id,
    creator: pm1
  });

  const t10 = await seedTask({
    title: 'DigiLocker KYC XML parsing & face-match verify',
    description: 'Integrate Aadhaar XML verification with offline liveness check SDK.',
    status: TaskStatus.TODO,
    priority: Priority.LOW,
    dueDate: futureDate3,
    projectId: project2.id,
    developerId: dev2.id,
    creator: pm1
  });

  // ── Project 3 Tasks (5 tasks) ─────────────────────────────────────────────────
  const t11 = await seedTask({
    title: 'WebRTC TURN relay server cluster deployment',
    description:
      'Deploy geographically distributed Coturn nodes in Mumbai and Bangalore regions to guarantee fallback connectivity.',
    status: TaskStatus.IN_PROGRESS,
    priority: Priority.CRITICAL,
    dueDate: futureDate1,
    projectId: project3.id,
    developerId: dev1.id,
    creator: pm2
  });

  const t12 = await seedTask({
    title: 'Doctor slot calendar timezone & holiday sync',
    description:
      'Support multi-state regional holiday calendars and automatic DST adjustments for NRI patient consults.',
    status: TaskStatus.IN_REVIEW,
    priority: Priority.HIGH,
    dueDate: futureDate1,
    projectId: project3.id,
    developerId: dev3.id,
    creator: pm2
  });

  const t13 = await seedTask({
    title: 'Prescription handwritten OCR extraction engine',
    description:
      'Fine-tune PaddleOCR pipeline on Indian handwritten pharmaceutical brand names and dosage codes.',
    status: TaskStatus.TODO,
    priority: Priority.MEDIUM,
    dueDate: pastDate2, // OVERDUE
    isOverdue: true,
    projectId: project3.id,
    developerId: dev2.id,
    creator: pm2
  });

  const t14 = await seedTask({
    title: 'ABDM Health ID (ABHA) bridge integration',
    description:
      'Connect with National Health Authority sandbox to issue ABHA numbers and link patient records.',
    status: TaskStatus.TODO,
    priority: Priority.HIGH,
    dueDate: futureDate2,
    projectId: project3.id,
    developerId: dev4.id,
    creator: pm2
  });

  const t15 = await seedTask({
    title: 'WhatsApp appointment confirmation bot webhook',
    description:
      'Send templated interactive message with reschedule and join video call links via Meta Cloud API.',
    status: TaskStatus.DONE,
    priority: Priority.LOW,
    dueDate: pastDate1,
    projectId: project3.id,
    developerId: dev4.id,
    creator: pm2
  });

  console.log('✅ Created 15 real-world engineering tasks (3 overdue: t4, t7, t13)');

  // ── Pre-seeded status-change activity logs ────────────────────────────────────
  await prisma.activity.create({
    data: {
      action: 'STATUS_CHANGED',
      description: `${dev2.name} moved Task #${t3.id} to In Review: Ready for staging soak test`,
      oldStatus: TaskStatus.IN_PROGRESS,
      newStatus: TaskStatus.IN_REVIEW,
      taskId: t3.id,
      projectId: project1.id,
      userId: dev2.id,
      createdAt: new Date(Date.now() - 12 * 60 * 1000)
    }
  });

  await prisma.activity.create({
    data: {
      action: 'STATUS_CHANGED',
      description: `${dev3.name} moved Task #${t8.id} to In Review: Resiliency tests passing 98% coverage`,
      oldStatus: TaskStatus.IN_PROGRESS,
      newStatus: TaskStatus.IN_REVIEW,
      taskId: t8.id,
      projectId: project2.id,
      userId: dev3.id,
      createdAt: new Date(Date.now() - 28 * 60 * 1000)
    }
  });

  await prisma.activity.create({
    data: {
      action: 'STATUS_CHANGED',
      description: `${dev1.name} completed Task #${t1.id}: PostGIS spatial indexes deployed to production`,
      oldStatus: TaskStatus.IN_REVIEW,
      newStatus: TaskStatus.DONE,
      taskId: t1.id,
      projectId: project1.id,
      userId: dev1.id,
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000)
    }
  });

  await prisma.activity.create({
    data: {
      action: 'STATUS_CHANGED',
      description: `${dev1.name} completed Task #${t6.id}: UPI idempotency ledger live in production`,
      oldStatus: TaskStatus.IN_REVIEW,
      newStatus: TaskStatus.DONE,
      taskId: t6.id,
      projectId: project2.id,
      userId: dev1.id,
      createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000)
    }
  });

  console.log('✅ Created pre-seeded activity log entries');

  // ── Pre-seeded notifications ──────────────────────────────────────────────────
  await prisma.notification.create({
    data: {
      userId: pm1.id,
      title: 'Pull Request Ready for Review',
      message: `Task #${t3.id} "Real-time WebSocket telemetry for delivery fleets" has been submitted for QA approval.`,
      link: `/projects/${project1.id}`,
      isRead: false
    }
  });

  await prisma.notification.create({
    data: {
      userId: pm1.id,
      title: 'Task In Review',
      message: `Task #${t8.id} "Multi-bank payout failover circuit breaker" was submitted for review by ${dev3.name}.`,
      link: `/projects/${project2.id}`,
      isRead: false
    }
  });

  await prisma.notification.create({
    data: {
      userId: dev1.id,
      title: 'P0 Critical Task Assigned',
      message: `You have been assigned to "Kafka rider dispatch consumer lag backpressure" — P0 Critical priority.`,
      link: `/projects/${project1.id}`,
      isRead: false
    }
  });

  await prisma.notification.create({
    data: {
      userId: pm2.id,
      title: 'Task In Review',
      message: `Task #${t12.id} "Doctor slot calendar timezone & holiday sync" was submitted for review.`,
      link: `/projects/${project3.id}`,
      isRead: false
    }
  });

  await prisma.notification.create({
    data: {
      userId: dev3.id,
      title: 'SLA Breach Alert',
      message: `Task #${t7.id} "SEBI compliance audit logging" is now overdue. Immediate attention required.`,
      link: `/projects/${project2.id}`,
      isRead: false
    }
  });

  console.log('✅ Created pre-seeded notifications');
  console.log('');
  console.log('🎉 Seed complete!');
  console.log('');
  console.log('  Demo accounts (all password: Password@123)');
  console.log(`  Admin     → admin@velozity.com`);
  console.log(`  PM 1      → ravi.pm@velozity.com      (manages Projects 1 & 2)`);
  console.log(`  PM 2      → ananya.pm@velozity.com    (manages Project 3)`);
  console.log(`  Dev 1     → priya.dev@velozity.com`);
  console.log(`  Dev 2     → siddharth.dev@velozity.com`);
  console.log(`  Dev 3     → marcus.dev@velozity.com`);
  console.log(`  Dev 4     → kavya.dev@velozity.com`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
