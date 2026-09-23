import { NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'

const databaseName = process.env.MONGODB_DB || 'attendly'
const workspaceId = 'default-workspace'

export async function GET() {
  const client = await clientPromise
  const db = client.db(databaseName)
  const [workspace, people, attendance] = await Promise.all([
    db.collection('workspaces').findOne({ workspaceId }, { projection: { _id: 0 } }),
    db.collection('people').find({ workspaceId }, { projection: { _id: 0, workspaceId: 0 } }).toArray(),
    db.collection('attendance').find({ workspaceId }, { projection: { _id: 0, workspaceId: 0 } }).sort({ createdAt: -1 }).toArray(),
  ])
  return NextResponse.json({ workspace, people, attendance })
}

export async function DELETE() {
  const client = await clientPromise
  const db = client.db(databaseName)
  await Promise.all([
    db.collection('people').deleteMany({ workspaceId }),
    db.collection('attendance').deleteMany({ workspaceId }),
    db.collection('workspaces').deleteMany({ workspaceId }),
  ])
  return NextResponse.json({ ok: true })
}

export async function PUT(request: Request) {
  const body = await request.json()
  const client = await clientPromise
  const db = client.db(databaseName)
  const now = new Date()
  await Promise.all([
    db.collection('workspaces').updateOne({ workspaceId }, { $set: { ...body.workspace, workspaceId, updatedAt: now } }, { upsert: true }),
    ...(Array.isArray(body.people) ? [db.collection('people').deleteMany({ workspaceId }), ...(body.people.length ? [db.collection('people').insertMany(body.people.map((person: Record<string, unknown>) => ({ ...person, workspaceId })))] : [])] : []),
    ...(Array.isArray(body.attendance) ? [db.collection('attendance').deleteMany({ workspaceId }), ...(body.attendance.length ? [db.collection('attendance').insertMany(body.attendance.map((event: Record<string, unknown>) => ({ ...event, workspaceId, createdAt: now })))] : [])] : []),
  ])
  return NextResponse.json({ ok: true })
}
